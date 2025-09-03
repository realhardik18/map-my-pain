import requests
import time

url = "http://localhost:3000/api/log"

# Hardcoded 10 logs: mouth soreness with declining intensity (year 2021)
logs = [
    {
        "_id": "1",
        "patient_email": "hrdk.biz@gmail.com",
        "timestamp": "2021-09-01T08:00:00",
        "body_parts": [{"body_part": "mouth", "intensity": 9.0, "notes": "Severe mouth soreness, difficult to eat."}],
        "general_flag": 1,
        "ai_summary": "Mouth soreness, intensity 9/10, significant impact on eating.",
        "pdf_data": "Report 1",
        "medication": {"taking": True, "name": "Mouth Rinse", "dose": 1, "effectiveness": "mild"}
    },
    {
        "_id": "2",
        "patient_email": "hrdk.biz@gmail.com",
        "timestamp": "2021-09-01T12:00:00",
        "body_parts": [{"body_part": "mouth", "intensity": 8.2, "notes": "Soreness still present but slightly reduced after rinse."}],
        "general_flag": 1,
        "ai_summary": "Mouth soreness, intensity 8.2/10, slight relief after rinse.",
        "pdf_data": "Report 2",
        "medication": {"taking": True, "name": "Mouth Rinse", "dose": 1, "effectiveness": "mild"}
    },
    {
        "_id": "3",
        "patient_email": "hrdk.biz@gmail.com",
        "timestamp": "2021-09-01T16:00:00",
        "body_parts": [{"body_part": "mouth", "intensity": 7.4, "notes": "Pain easing slightly, still uncomfortable when talking."}],
        "general_flag": 1,
        "ai_summary": "Mouth soreness, intensity 7.4/10, moderate discomfort when speaking.",
        "pdf_data": "Report 3",
        "medication": {"taking": True, "name": "Oral Gel", "dose": 1, "effectiveness": "moderate"}
    },
    {
        "_id": "4",
        "patient_email": "hrdk.biz@gmail.com",
        "timestamp": "2021-09-01T20:00:00",
        "body_parts": [{"body_part": "mouth", "intensity": 6.7, "notes": "Able to eat soft foods, soreness decreasing."}],
        "general_flag": 1,
        "ai_summary": "Mouth soreness, intensity 6.7/10, improving with treatment.",
        "pdf_data": "Report 4",
        "medication": {"taking": True, "name": "Pain Relief Tablet", "dose": 200, "effectiveness": "good"}
    },
    {
        "_id": "5",
        "patient_email": "hrdk.biz@gmail.com",
        "timestamp": "2021-09-02T08:00:00",
        "body_parts": [{"body_part": "mouth", "intensity": 6.0, "notes": "Noticeable improvement, can chew soft foods slowly."}],
        "general_flag": 1,
        "ai_summary": "Mouth soreness, intensity 6/10, noticeable relief.",
        "pdf_data": "Report 5",
        "medication": {"taking": True, "name": "Pain Relief Tablet", "dose": 200, "effectiveness": "good"}
    },
    {
        "_id": "6",
        "patient_email": "hrdk.biz@gmail.com",
        "timestamp": "2021-09-02T12:00:00",
        "body_parts": [{"body_part": "mouth", "intensity": 5.3, "notes": "Mild soreness, eating easier now."}],
        "general_flag": 1,
        "ai_summary": "Mouth soreness, intensity 5.3/10, eating becoming easier.",
        "pdf_data": "Report 6",
        "medication": {"taking": True, "name": "Pain Relief Tablet", "dose": 200, "effectiveness": "good"}
    },
    {
        "_id": "7",
        "patient_email": "hrdk.biz@gmail.com",
        "timestamp": "2021-09-02T18:00:00",
        "body_parts": [{"body_part": "mouth", "intensity": 4.7, "notes": "Mild pain remains, talking almost normal."}],
        "general_flag": 1,
        "ai_summary": "Mouth soreness, intensity 4.7/10, improved communication ability.",
        "pdf_data": "Report 7",
        "medication": {"taking": True, "name": "Oral Gel", "dose": 1, "effectiveness": "good"}
    },
    {
        "_id": "8",
        "patient_email": "hrdk.biz@gmail.com",
        "timestamp": "2021-09-03T08:00:00",
        "body_parts": [{"body_part": "mouth", "intensity": 4.0, "notes": "Pain reduced, can eat with little discomfort."}],
        "general_flag": 1,
        "ai_summary": "Mouth soreness, intensity 4/10, significant improvement.",
        "pdf_data": "Report 8",
        "medication": {"taking": True, "name": "Pain Relief Tablet", "dose": 100, "effectiveness": "good"}
    },
    {
        "_id": "9",
        "patient_email": "hrdk.biz@gmail.com",
        "timestamp": "2021-09-03T16:00:00",
        "body_parts": [{"body_part": "mouth", "intensity": 3.2, "notes": "Minor soreness, nearly back to normal."}],
        "general_flag": 1,
        "ai_summary": "Mouth soreness, intensity 3.2/10, near full recovery.",
        "pdf_data": "Report 9",
        "medication": {"taking": False, "name": "", "dose": 0, "effectiveness": ""}
    },
    {
        "_id": "10",
        "patient_email": "hrdk.biz@gmail.com",
        "timestamp": "2021-09-04T08:00:00",
        "body_parts": [{"body_part": "mouth", "intensity": 2.5, "notes": "Only mild soreness remains, almost resolved."}],
        "general_flag": 1,
        "ai_summary": "Mouth soreness, intensity 2.5/10, condition nearly resolved.",
        "pdf_data": "Report 10",
        "medication": {"taking": False, "name": "", "dose": 0, "effectiveness": ""}
    }
]

# Send each log to the server
for log in logs:
    response = requests.post(url, json=log)
    print(f"Sent log {log['_id']} | Status: {response.status_code}")
    try:
        print("Response:", response.json())
    except:
        print("Response Text:", response.text)
    time.sleep(0.5)  # optional delay
