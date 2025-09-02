import requests
import datetime
import uuid
import json

API_URL = "http://localhost:3000/api/log"  # <-- change to your Next.js API route
PATIENT_EMAIL = "hrdk.biz@gmail.com"

DAILY_DESCRIPTIONS = [
    "Severe pain at the top of the head, sharp and draining energy.",
    "Pain still intense but slightly less overwhelming than yesterday.",
    "Strong discomfort remains, though it feels a bit duller and less sharp.",
    "Pain beginning to ease, still noticeable but slightly more tolerable.",
    "Pain has lessened to a moderate level, allowing more daily activity.",
    "Pain continues to decline, more of an ache than a sharp throb.",
    "Noticeable relief, pain is moderate but no longer dominating attention.",
    "Pain is mild to moderate, present but manageable without much disruption.",
    "Pain is mild, felt occasionally but not constant.",
    "Pain reduced significantly, only mild traces remain and are tolerable."
]

def simulate_pain_logs():
    start_date = datetime.datetime.now()
    logs = []

    for day in range(10):
        date = start_date + datetime.timedelta(days=day)
        pain_level = round(9.3 - (6.3 * day / 9), 1)  # 9.3 → 3.0

        # Data for API (safe for MongoDB)
        log_api = {
            "_id": uuid.uuid4().hex,  # let Mongo accept it as string
            "patient_email": PATIENT_EMAIL,
            "timestamp": date.isoformat(),
            "body_parts": [
                {
                    "mesh_name": "head_top",
                    "pain_level": pain_level,
                    "description": DAILY_DESCRIPTIONS[day]
                }
            ]
        }

        # Data for printing (MongoDB Extended JSON look)
        log_extended = {
            "_id": {"$oid": log_api["_id"]},
            "patient_email": log_api["patient_email"],
            "timestamp": log_api["timestamp"],
            "body_parts": [
                {
                    "mesh_name": "head_top",
                    "pain_level": {"$numberDouble": str(pain_level)},
                    "description": DAILY_DESCRIPTIONS[day]
                }
            ]
        }

        logs.append(log_extended)

        # Send only plain log to API
        try:
            response = requests.post(API_URL, json=log_api)
            if response.status_code == 200:
                print(f"[Day {day+1}] Sent to API: Pain {pain_level}/10")
            else:
                print(f"[Day {day+1}] Failed: {response.text}")
        except Exception as e:
            print(f"[Day {day+1}] Error: {e}")

    return logs

if __name__ == "__main__":
    all_logs = simulate_pain_logs()
    print("\nSimulation complete. Extended JSON logs (for reference):")
    print(json.dumps(all_logs, indent=2))
