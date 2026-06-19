from flask import Flask, render_template, request, jsonify
import sqlite3
import os
from datetime import datetime

app = Flask(__name__)

DB_FILE = 'traffic.db'

def init_db():
    """Initializes the SQLite database with tables and sample data if empty."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Create tables
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS lanes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
    )
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS traffic_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lane_id INTEGER NOT NULL,
        vehicle_count INTEGER NOT NULL,
        density_level TEXT NOT NULL,
        green_time INTEGER NOT NULL,
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (lane_id) REFERENCES lanes(id)
    )
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS emergency_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lane_id INTEGER NOT NULL,
        triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (lane_id) REFERENCES lanes(id)
    )
    """)
    
    # Insert default lanes
    cursor.execute("INSERT OR IGNORE INTO lanes (id, name) VALUES (1, 'North Lane')")
    cursor.execute("INSERT OR IGNORE INTO lanes (id, name) VALUES (2, 'South Lane')")
    cursor.execute("INSERT OR IGNORE INTO lanes (id, name) VALUES (3, 'East Lane')")
    cursor.execute("INSERT OR IGNORE INTO lanes (id, name) VALUES (4, 'West Lane')")
    
    # Check if logs are empty, if so, insert sample data
    cursor.execute("SELECT COUNT(*) FROM traffic_logs")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO traffic_logs (lane_id, vehicle_count, density_level, green_time) VALUES (1, 15, 'Low', 10)")
        cursor.execute("INSERT INTO traffic_logs (lane_id, vehicle_count, density_level, green_time) VALUES (2, 45, 'Medium', 20)")
        cursor.execute("INSERT INTO traffic_logs (lane_id, vehicle_count, density_level, green_time) VALUES (3, 80, 'High', 30)")
        cursor.execute("INSERT INTO traffic_logs (lane_id, vehicle_count, density_level, green_time) VALUES (4, 25, 'Low', 10)")
        
    cursor.execute("SELECT COUNT(*) FROM emergency_logs")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO emergency_logs (lane_id) VALUES (1)")
        
    conn.commit()
    conn.close()

def get_db_connection():
    """Helper function to establish a database connection."""
    try:
        connection = sqlite3.connect(DB_FILE)
        connection.row_factory = sqlite3.Row
        return connection
    except Exception as e:
        print(f"Database connection error: {e}")
        return None

@app.route('/')
def index():
    """Renders the main frontend dashboard."""
    return render_template('index.html')

@app.route('/api/update_density', methods=['POST'])
def update_density():
    """
    Receives manual vehicle count for a lane, calculates density and green time,
    and logs it in the database.
    """
    data = request.json
    lane_id = data.get('lane_id')
    vehicle_count = int(data.get('vehicle_count', 0))

    # Calculate density and signal timing
    # Logic: 
    #   < 20 vehicles = Low Density (10s green)
    #   20 - 50 vehicles = Medium Density (20s green)
    #   > 50 vehicles = High Density (30s green)
    if vehicle_count < 20:
        density = 'Low'
        green_time = 10
    elif vehicle_count <= 50:
        density = 'Medium'
        green_time = 20
    else:
        density = 'High'
        green_time = 30

    # Save to database
    conn = get_db_connection()
    if conn:
        try:
            cursor = conn.cursor()
            sql = "INSERT INTO traffic_logs (lane_id, vehicle_count, density_level, green_time) VALUES (?, ?, ?, ?)"
            cursor.execute(sql, (lane_id, vehicle_count, density, green_time))
            conn.commit()
        except Exception as e:
            print(f"Error saving traffic log: {e}")
        finally:
            conn.close()

    return jsonify({
        'status': 'success',
        'lane_id': lane_id,
        'density': density,
        'green_time': green_time,
        'vehicle_count': vehicle_count
    })

@app.route('/api/emergency', methods=['POST'])
def trigger_emergency():
    """
    Logs an emergency event for a specific lane.
    """
    data = request.json
    lane_id = data.get('lane_id')

    conn = get_db_connection()
    if conn:
        try:
            cursor = conn.cursor()
            sql = "INSERT INTO emergency_logs (lane_id) VALUES (?)"
            cursor.execute(sql, (lane_id,))
            conn.commit()
        except Exception as e:
            print(f"Error saving emergency log: {e}")
        finally:
            conn.close()

    return jsonify({'status': 'success', 'message': f'Emergency triggered for lane {lane_id}'})

@app.route('/api/status', methods=['GET'])
def get_status():
    """
    Fetches analytics data: total vehicles today, peak hour, and hourly breakdown.
    """
    conn = get_db_connection()
    analytics = {
        'total_vehicles': 0,
        'peak_hour': 'N/A',
        'hourly_data': []
    }

    if conn:
        try:
            cursor = conn.cursor()
            # 1. Total vehicles today
            cursor.execute("""
                SELECT SUM(vehicle_count) as total 
                FROM traffic_logs 
                WHERE date(recorded_at, 'localtime') = date('now', 'localtime')
            """)
            result = cursor.fetchone()
            if result and result['total']:
                analytics['total_vehicles'] = int(result['total'])

            # 2. Peak hour today
            cursor.execute("""
                SELECT strftime('%H', recorded_at, 'localtime') as hour, SUM(vehicle_count) as total_volume
                FROM traffic_logs
                WHERE date(recorded_at, 'localtime') = date('now', 'localtime')
                GROUP BY hour
                ORDER BY total_volume DESC
                LIMIT 1
            """)
            peak_result = cursor.fetchone()
            if peak_result and peak_result['hour'] is not None:
                # Format hour neatly, e.g., "14:00 - 15:00"
                h = int(peak_result['hour'])
                analytics['peak_hour'] = f"{h:02d}:00 - {(h+1)%24:02d}:00"

            # 3. Hourly traffic for charts/tables
            cursor.execute("""
                SELECT CAST(strftime('%H', recorded_at, 'localtime') AS INTEGER) as hour, SUM(vehicle_count) as total_volume
                FROM traffic_logs
                WHERE date(recorded_at, 'localtime') = date('now', 'localtime')
                GROUP BY hour
                ORDER BY hour ASC
            """)
            hourly_rows = cursor.fetchall()
            analytics['hourly_data'] = [dict(row) for row in hourly_rows]
        except Exception as e:
            print(f"Error fetching analytics: {e}")
        finally:
            conn.close()

    return jsonify(analytics)

@app.route('/api/emergency_history', methods=['GET'])
def get_emergency_history():
    """
    Fetches the recent emergency logs with lane names.
    """
    conn = get_db_connection()
    logs = []
    if conn:
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT e.id, datetime(e.triggered_at, 'localtime') as triggered_at, l.name as lane_name
                FROM emergency_logs e
                JOIN lanes l ON e.lane_id = l.id
                ORDER BY e.triggered_at DESC
                LIMIT 10
            """)
            rows = cursor.fetchall()
            logs = [dict(row) for row in rows]
        except Exception as e:
            print(f"Error fetching emergency logs: {e}")
        finally:
            conn.close()
    return jsonify(logs)

if __name__ == '__main__':
    init_db()
    app.run(debug=True)
