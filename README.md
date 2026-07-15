# Smart Traffic Management System

This is a modern, feature-rich DBMS mini-project built using Python (Flask), SQLite, and HTML/CSS/JavaScript. It demonstrates how to manage traffic signals dynamically based on vehicle density, adjust timings for weather conditions, prioritize pedestrian crossings, manage emergency vehicle priority, and explore traffic history through filters and CSV exports.

## 🌟 Advanced Features Included
1. **Vehicle Density Detection:** Manual or simulated input of vehicle counts to dynamically adjust signal timings.
2. **Signal Timing Optimization:** Automatically calculates green light duration (Low density, Medium density, High density) based on configurable thresholds.
3. **Emergency Vehicle Priority:** A button to immediately turn a lane green and force all others to red.
4. **Active Weather Settings:** Adjusts green timings using multipliers to compensate for wet/icy roads (Rain: 1.5x, Fog: 1.3x, Snow: 1.8x, Clear: 1.0x).
5. **Pedestrian Crossing Priority:** Pedestrians can request crossing for any lane, which triggers a priority 15-second green light cycle for that lane (logged in DB).
6. **Busiest Hour & Volume Analytics:** Live stats for total daily vehicles, peak traffic hour, and hourly volume chart.
7. **Detailed Logs Viewer:** Dropdown filter selectors to search logs by lane and density level in real-time.
8. **CSV Exporter:** Download search-filtered log data instantly in standard CSV format.
9. **Signal Configurations Settings Panel:** Save custom timing values and density thresholds directly into the database at runtime.
10. **Auto Simulation Mode:** Toggle auto-simulation to inject random vehicle volumes and test timing behavior.

---

## 🚀 How to Set Up and Run on Your Laptop

### Step 1: Install Python
Install Python from `python.org` (Ensure you check "Add Python to PATH" during installation).

### Step 2: Install Libraries
Open your terminal (Command Prompt or PowerShell) and run the following command:
```bash
pip install flask
```

### Step 3: Run the Application
1. In your terminal, navigate to the folder where you saved this project:
   ```bash
   cd path/to/SMART-TRAFFIC-SYSTEM
   ```
2. Run the Flask backend:
   ```bash
   python app.py
   ```
   *The SQLite database (`traffic.db`) will be automatically created and populated with default data on first launch.*
3. Open your web browser and go to: `http://127.0.0.1:5000`

### Step 4: Run Automated Tests
To run the test suite and verify all API endpoints and database logic work:
```bash
python -m unittest tests/test_app.py
```

---

## 📝 Database Schema & Structure (SQLite)

- **`lanes` table:** Stores the 4 directions (North, South, East, West).
- **`traffic_logs` table:** Records every vehicle density update (lane ID, vehicle count, density level, green time, recorded time). Used for calculating analytics.
- **`emergency_logs` table:** Keeps a historical record of emergency priority overrides.
- **`pedestrian_requests` table:** Tracks every pedestrian crossing priority trigger.
- **`system_settings` table:** Stores persistent configuration settings (weather mode, vehicle density thresholds, and green light timings).


---

## 🔌 API Reference

- **`GET /api/status`:** Returns analytics summary including total vehicle volume and busiest hour.
- **`POST /api/update_density`:** Submits lane vehicle count and calculates dynamic green light timing.
- **`POST /api/emergency`:** Triggers 30-second priority green light override for the specified lane.
- **`POST /api/pedestrian_crossing`:** Requests 15-second priority walk signal window for the specified lane.
- **`GET /api/weather` / `POST /api/weather`:** Fetches or updates current weather mode (Rain, Snow, Fog, Clear).
- **`GET /api/config` / `POST /api/config`:** Retrieves or saves timing thresholds configuration.
- **`GET /api/logs`:** Searches historical traffic logs with optional query filters.
- **`GET /api/logs/export`:** Streams search-filtered database log history directly in CSV format.

---

## 👥 Contributors

- **Dushyanth136** - Core Developer & System Designer
