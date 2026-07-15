# Configuration Manager for Smart Traffic Management System
# Contains database settings, default timings, thresholds, and multipliers.

import os

# Database Configuration
DB_FILE = os.environ.get('TRAFFIC_DB_FILE', 'traffic.db')

# Signal Timings (Seconds)
GREEN_TIME_LOW = 10
GREEN_TIME_MEDIUM = 20
GREEN_TIME_HIGH = 30

# Density Thresholds (Vehicle Count)
THRESHOLD_LOW = 20
THRESHOLD_MEDIUM = 50

# Weather Timing Multipliers (increases green time to handle slower speeds/braking)
WEATHER_MULTIPLIERS = {
    'Clear': 1.0,
    'Rain': 1.5,
    'Fog': 1.3,
    'Snow': 1.8
}
