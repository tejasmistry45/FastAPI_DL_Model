# load test Script using locustfile 

from locust import HttpUser, task, between
import os

class CarClassifierUser(HttpUser):
    wait_time = between(1, 5)  # Users wait 1-5 seconds between requests
    
    def on_start(self):
        """Called when user starts - like user login"""
        print("User started testing")
    
    @task(3)  # Weight 3 - runs 3x more often
    def classify_car_image(self):
        """Simulate car image classification"""
        # Use a test image file
        with open('swift.png', 'rb') as image_file:
            files = {'file': ('swift.png', image_file, 'image/jpeg')}
            response = self.client.post('/predict', files=files)
            
            if response.status_code == 200:
                print(f"✅ Success: {response.json()}")
            else:
                print(f"❌ Failed: {response.status_code}")
    
    @task(1)  # Weight 1 - runs less frequently  
    def health_check(self):
        """Test health endpoint"""
        self.client.get('/health')
    
    @task(1)
    def get_frontend(self):
        """Test serving frontend"""
        self.client.get('/')


# command to execute this script 
# locust -f locustfile.py --host=http://localhost:8000