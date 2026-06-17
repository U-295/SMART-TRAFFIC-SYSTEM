-- Create the database if it doesn't exist
CREATE DATABASE IF NOT EXISTS smart_traffic;
USE smart_traffic;

-- 1. Lanes Table: Stores the names of our 4 lanes
CREATE TABLE IF NOT EXISTS lanes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

-- 2. Traffic Logs Table: Stores vehicle count, density, and calculated signal timings
CREATE TABLE IF NOT EXISTS traffic_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lane_id INT NOT NULL,
    vehicle_count INT NOT NULL,
    density_level VARCHAR(20) NOT NULL, -- e.g., 'Low', 'Medium', 'High'
    green_time INT NOT NULL, -- Calculated green signal duration in seconds
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lane_id) REFERENCES lanes(id)
);

-- 3. Emergency Logs Table: Tracks whenever an emergency vehicle is given priority
CREATE TABLE IF NOT EXISTS emergency_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lane_id INT NOT NULL,
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lane_id) REFERENCES lanes(id)
);

-- ==========================================
-- Insert Sample Data for Initial Setup
-- ==========================================

-- Insert the 4 default lanes (Ignore if they already exist)
INSERT IGNORE INTO lanes (id, name) VALUES 
(1, 'North Lane'), 
(2, 'South Lane'), 
(3, 'East Lane'), 
(4, 'West Lane');

-- Insert some sample traffic logs so the analytics dashboard isn't empty initially
INSERT INTO traffic_logs (lane_id, vehicle_count, density_level, green_time) VALUES
(1, 15, 'Low', 10),
(2, 45, 'Medium', 20),
(3, 80, 'High', 30),
(4, 25, 'Low', 10);

-- Insert a sample emergency log
INSERT INTO emergency_logs (lane_id) VALUES (1);
