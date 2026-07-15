import unittest
import json
import os
import sys

# Add root folder to path so python can find app and database
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import app
import database
import config

class SmartTrafficTestCase(unittest.TestCase):
    def setUp(self):
        # Use a temporary test database file
        self.test_db = 'test_traffic.db'
        config.DB_FILE = self.test_db
        database.DB_FILE = self.test_db
        
        # Initialize app client
        app.app.config['TESTING'] = True
        self.client = app.app.test_client()
        
        # Initialize the test database
        database.init_db()

    def tearDown(self):
        # Remove the test database file
        if os.path.exists(self.test_db):
            try:
                os.remove(self.test_db)
            except PermissionError:
                pass

    def test_db_initialization(self):
        """Test database is created and initialized with default data."""
        self.assertTrue(os.path.exists(self.test_db))
        
        # Query lanes to make sure default lanes exist
        conn = database.get_db_connection()
        self.assertIsNotNone(conn)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM lanes")
        count = cursor.fetchone()[0]
        self.assertEqual(count, 4)
        conn.close()

    def test_get_index(self):
        """Test that the index renders successfully."""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)

    def test_update_density_api(self):
        """Test posting traffic density updates."""
        payload = {
            'lane_id': 1,
            'vehicle_count': 15
        }
        response = self.client.post('/api/update_density', 
                                    data=json.dumps(payload),
                                    content_type='application/json')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'success')
        self.assertEqual(data['density'], 'Low')
        self.assertEqual(data['green_time'], 10)

    def test_emergency_api(self):
        """Test triggering emergency priority."""
        payload = {
            'lane_id': 2
        }
        response = self.client.post('/api/emergency', 
                                    data=json.dumps(payload),
                                    content_type='application/json')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'success')

    def test_weather_api(self):
        """Test fetching and setting weather conditions."""
        # 1. Fetch default weather (should be Clear)
        response = self.client.get('/api/weather')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['weather'], 'Clear')
        
        # 2. Update weather to Rain
        payload = {'weather': 'Rain'}
        response = self.client.post('/api/weather', 
                                    data=json.dumps(payload),
                                    content_type='application/json')
        self.assertEqual(response.status_code, 200)
        
        # 3. Check that it was set
        response = self.client.get('/api/weather')
        data = json.loads(response.data)
        self.assertEqual(data['weather'], 'Rain')

    def test_pedestrian_crossing_api(self):
        """Test logging pedestrian crossing requests."""
        payload = {'lane_id': 3}
        response = self.client.post('/api/pedestrian_crossing', 
                                    data=json.dumps(payload),
                                    content_type='application/json')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'success')

    def test_config_api(self):
        """Test GET and POST configuration adjustments."""
        # 1. Test GET config
        response = self.client.get('/api/config')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['threshold_low'], 20)
        
        # 2. Test POST config to change settings
        new_config = {
            'threshold_low': 15,
            'threshold_medium': 45,
            'green_time_low': 8,
            'green_time_medium': 18,
            'green_time_high': 28
        }
        response = self.client.post('/api/config', 
                                    data=json.dumps(new_config),
                                    content_type='application/json')
        self.assertEqual(response.status_code, 200)
        
        # 3. Verify GET config returns updated settings
        response = self.client.get('/api/config')
        data = json.loads(response.data)
        self.assertEqual(data['threshold_low'], 15)
        self.assertEqual(data['green_time_high'], 28)

    def test_weather_multiplier_rain(self):
        """Test that weather 'Rain' correctly multiplies low green time."""
        self.client.post('/api/weather', 
                         data=json.dumps({'weather': 'Rain'}),
                         content_type='application/json')
        response = self.client.post('/api/update_density', 
                                    data=json.dumps({'lane_id': 1, 'vehicle_count': 15}),
                                    content_type='application/json')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['green_time'], 15)

if __name__ == '__main__':
    unittest.main()
