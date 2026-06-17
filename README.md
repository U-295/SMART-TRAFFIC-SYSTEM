# Smart Traffic Management System

This is a beginner-friendly DBMS mini-project built using Python (Flask), MySQL, and HTML/CSS/JavaScript. It demonstrates how to manage traffic signals dynamically based on vehicle density, handle emergency overrides, and display live analytics.

## Features Included
1. **Vehicle Density Detection:** Manual input of vehicle counts to dynamically adjust signal timing.
2. **Signal Timing Optimisation:** Automatically calculates green light duration (Low density = 10s, Medium = 20s, High = 30s).
3. **Emergency Vehicle Priority:** A button to immediately turn a lane green and force all others to red.
4. **Traffic Analytics Dashboard:** Shows total vehicles, peak traffic hour, and an hourly breakdown using MySQL data.
5. **Auto Signal Timer:** A visual countdown timer that auto-switches between lanes.

---

## 🚀 How to Set Up and Run on Your Laptop

### Step 1: Install Prerequisites
1. **Install XAMPP** (or MySQL Installer) to run a local MySQL database.
   - Start the **MySQL** module in the XAMPP Control Panel.
2. **Install Python** from `python.org` (Make sure to check "Add Python to PATH" during installation).

### Step 2: Set Up the Database
1. Open XAMPP and click the **Admin** button next to MySQL to open `phpMyAdmin`.
2. Go to the **Import** tab.
3. Choose the `schema.sql` file from this project folder and click **Import** (or **Go**).
   - *This will automatically create the database `smart_traffic_db`, the required tables, and insert some sample data.*

### Step 3: Install Python Libraries
Open your terminal (Command Prompt or PowerShell) and run the following commands:
```bash
pip install flask
pip install pymysql
```

### Step 4: Run the Application
1. In your terminal, navigate to the folder where you saved this project (`cd path/to/SmartTrafficSystem`).
2. Run the Flask backend:
```bash
python app.py
```
3. Open your web browser and go to: `http://127.0.0.1:5000`

---

## 📝 Code Explanation (For Your Viva/Presentation)

To help you defend your project, here is a simple explanation of how the major parts work:

### 1. Database (`schema.sql`)
- **`lanes` table:** Simply stores the 4 directions (North, South, East, West).
- **`traffic_logs` table:** Every time you press the "Update" button, a new row is added here containing the `vehicle_count` and the calculated `green_time`. We use this table to calculate our analytics (total vehicles and peak hour).
- **`emergency_logs` table:** Keeps a historical record of every time the Emergency Priority button was clicked.

### 2. Backend (`app.py`)
- **`Flask`** is a micro web framework for Python. It listens for HTTP requests from the browser.
- **`pymysql`** is the library that allows Python to talk to the MySQL database.
- **`@app.route('/api/update_density')`:** This is an API endpoint. When the user submits a vehicle count on the frontend, JavaScript sends the data here. Python checks if the count is `< 20` (Low), `20-50` (Medium), or `> 50` (High), calculates the seconds for the green light, saves it to the database, and sends the result back to the frontend.
- **`@app.route('/api/status')`:** This pulls data from `traffic_logs` using SQL `SUM()` and `GROUP BY HOUR()` functions to figure out the total vehicles today and the busiest hour, sending it back to the analytics dashboard.

### 3. Frontend (`index.html`, `style.css`, `script.js`)
- **`index.html`:** Uses semantic tags (`<section>`, `<div>`) to structure the 4 lanes and the analytics table.
- **`style.css`:** Uses CSS Custom Properties (`:root`) for the dark theme. The glowing traffic lights are created using `box-shadow` and `border-radius: 50%`.
- **`script.js`:** 
  - `setInterval` is used to create the countdown loop that runs every 1 second. 
  - When the timer hits 0, `switchToNextLane()` changes the active lane. 
  - `fetch()` is used to communicate with the Python backend without having to reload the page (this is called AJAX).
