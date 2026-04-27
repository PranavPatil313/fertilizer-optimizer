import requests
import json
import sys

BASE_URL = "http://localhost:8000"

def login(email, password):
    resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
    if resp.status_code != 200:
        print(f"Login failed: {resp.status_code} {resp.text}")
        return None
    data = resp.json()
    return data.get("access_token")

def fetch_training_jobs(token):
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(f"{BASE_URL}/admin/training-jobs", headers=headers)
    if resp.status_code != 200:
        print(f"Failed to fetch jobs: {resp.status_code} {resp.text}")
        return None
    return resp.json()

def fetch_datasets(token):
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(f"{BASE_URL}/admin/datasets", headers=headers)
    if resp.status_code != 200:
        print(f"Failed to fetch datasets: {resp.status_code} {resp.text}")
        return None
    return resp.json()

if __name__ == "__main__":
    email = "pranavpatil6717@gmail.com"
    password = "XW5YQreiMuxY"
    token = login(email, password)
    if not token:
        sys.exit(1)
    print("Token obtained")
    
    jobs = fetch_training_jobs(token)
    print("Training jobs:", json.dumps(jobs, indent=2))
    
    datasets = fetch_datasets(token)
    print("\nDatasets:", json.dumps(datasets, indent=2))