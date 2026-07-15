import sqlite3
import os
import config

DB_FILE = config.DB_FILE

def get_db_connection() -> sqlite3.Connection:
    """Helper function to establish a database connection."""
    try:
        connection = sqlite3.connect(DB_FILE)
        connection.row_factory = sqlite3.Row
        return connection
    except Exception as e:
        print(f"Database connection error: {e}")
        return None

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
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS pedestrian_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lane_id INTEGER NOT NULL,
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (lane_id) REFERENCES lanes(id)
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS weather_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        weather TEXT NOT NULL,
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
    """)
    
    cursor.execute("INSERT OR IGNORE INTO system_settings (key, value) VALUES ('weather', 'Clear')")
    
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

def add_traffic_log(lane_id, vehicle_count, density, green_time):
    """Inserts a new traffic density log."""
    conn = get_db_connection()
    if conn:
        try:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO traffic_logs (lane_id, vehicle_count, density_level, green_time) VALUES (?, ?, ?, ?)",
                (lane_id, vehicle_count, density, green_time)
            )
            conn.commit()
            return True
        except Exception as e:
            print(f"Error saving traffic log: {e}")
            return False
        finally:
            conn.close()
    return False

def add_emergency_log(lane_id):
    """Inserts a new emergency priority override log."""
    conn = get_db_connection()
    if conn:
        try:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO emergency_logs (lane_id) VALUES (?)", (lane_id,))
            conn.commit()
            return True
        except Exception as e:
            print(f"Error saving emergency log: {e}")
            return False
        finally:
            conn.close()
    return False

def get_analytics_today():
    """Fetches traffic analytics for today."""
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
                h = int(peak_result['hour'])
                analytics['peak_hour'] = f"{h:02d}:00 - {(h+1)%24:02d}:00"

            # 3. Hourly traffic
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
    return analytics

def get_emergency_history_logs(limit=10):
    """Fetches recent emergency logs."""
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
                LIMIT ?
            """, (limit,))
            rows = cursor.fetchall()
            logs = [dict(row) for row in rows]
        except Exception as e:
            print(f"Error fetching emergency logs: {e}")
        finally:
            conn.close()
    return logs

def get_setting(key, default_value=None):
    """Retrieves a setting value from the system_settings table."""
    conn = get_db_connection()
    if conn:
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT value FROM system_settings WHERE key = ?", (key,))
            row = cursor.fetchone()
            if row:
                return row['value']
        except Exception as e:
            print(f"Error getting setting {key}: {e}")
        finally:
            conn.close()
    return default_value

def set_setting(key, value):
    """Sets/Updates a setting value in the system_settings table."""
    conn = get_db_connection()
    if conn:
        try:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                (key, str(value))
            )
            conn.commit()
            return True
        except Exception as e:
            print(f"Error setting setting {key}: {e}")
            return False
        finally:
            conn.close()
    return False

def add_pedestrian_request(lane_id: int) -> bool:
    """Inserts a new pedestrian crossing request log."""
    conn = get_db_connection()
    if conn:
        try:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO pedestrian_requests (lane_id) VALUES (?)", (lane_id,))
            conn.commit()
            return True
        except Exception as e:
            print(f"Error saving pedestrian request log: {e}")
            return False
        finally:
            conn.close()
    return False

def get_filtered_logs(lane_id=None, density=None, limit=100):
    """Fetches traffic logs with filters for lane and density level."""
    conn = get_db_connection()
    logs = []
    if conn:
        try:
            cursor = conn.cursor()
            query = """
                SELECT t.id, t.vehicle_count, t.density_level, t.green_time, 
                       datetime(t.recorded_at, 'localtime') as recorded_at, l.name as lane_name
                FROM traffic_logs t
                JOIN lanes l ON t.lane_id = l.id
                WHERE 1=1
            """
            params = []
            if lane_id:
                query += " AND t.lane_id = ?"
                params.append(lane_id)
            if density:
                query += " AND t.density_level = ?"
                params.append(density)
            
            query += " ORDER BY t.recorded_at DESC LIMIT ?"
            params.append(limit)
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            logs = [dict(row) for row in rows]
        except Exception as e:
            print(f"Error filtering logs: {e}")
        finally:
            conn.close()
    return logs

def log_weather_change(weather: str) -> bool:
    """Inserts a new weather change log."""
    conn = get_db_connection()
    if conn:
        try:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO weather_logs (weather) VALUES (?)", (weather,))
            conn.commit()
            return True
        except Exception as e:
            print(f"Error logging weather change: {e}")
            return False
        finally:
            conn.close()
    return False
