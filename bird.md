# Bird Detector Backend Specification

This document outlines the requirements for the Python backend service to support the "Scarecrow" (Bird Detector) feature in the AgroTalk application.

## Overview
The backend is responsible for:
1.  **Video Processing**: Analyzing video input for generic bird detection.
2.  **Streaming**: Providing a real-time MJPEG stream of the processed video with bounding boxes.
3.  **Status Reporting**: Exposing an API to report current detection status (Safe/Detected).
4.  **Input Handling**: Supporting both live webcam feed (default/legacy) and **uploaded video files**.

## Tech Stack
-   **Language**: Python 3.9+
-   **Framework**: FastAPI
-   **CV Library**: Ultralytics YOLOv8 (`yolov8n.pt` - Nano model for speed)
-   **Image Processing**: OpenCV (`cv2`)
-   **Server**: Uvicorn

## API Endpoints

### 1. `GET /api/bird/feed`
-   **Description**: streams the processed video frames (MJPEG).
-   **Behavior**:
    -   If a video file has been uploaded and is active, stream frames from that file (looping or one-time).
    -   If no file is active, default to a placeholder or webcam (if configured).
    -   Frames must be annotated with bounding boxes for detected birds (Class ID 14 in COCO).
-   **Response**: `multipart/x-mixed-replace; boundary=frame`

### 2. `GET /api/bird/status`
-   **Description**: Returns the current detection status.
-   **Response JSON**:
    ```json
    {
      "detected": boolean,       // True if bird detected in recent frames
      "last_detected": string,   // ISO timestamp of last detection
      "confidence": float,       // Confidence score (0.0 - 1.0)
      "alert_active": boolean    // True if deterrent logic is triggered (e.g. cooldown passed)
    }
    ```

### 3. `POST /api/bird/upload` (NEW)
-   **Description**: Upload a video file for analysis.
-   **Request**: `multipart/form-data` with key `file`.
-   **Behavior**:
    -   Save the file temporarily.
    -   Switch the "video source" of the `/api/bird/feed` stream to this new file.
    -   Reset detection state.
-   **Response JSON**:
    ```json
    {
      "success": true,
      "message": "Video uploaded and processing started"
    }
    ```

### 4. `POST /api/bird/reset` (Optional)
-   **Description**: Clear the uploaded video and revert to default/idle state.

## Logic Requirements

### Detection Logic
-   Load `yolov8n.pt`.
-   Target Class: `14` (Bird).
-   Confidence Threshold: `0.5`.
-   Frame Rate: Limit processing to ~15-30 FPS to reduce load if necessary.

### Deterrent Logic (Backend or Frontend managed)
-   The backend status `alert_active` should be `true` only if:
    -   A bird is detected.
    -   AND Cooldown period (e.g., 5 seconds) has passed since the last alert.

## Directory Structure (Suggested)
```
backend_py/
├── main.py            # FastAPI app entry point
├── bird_server.py     # Endpoint logic
├── detector.py        # YOLOv8 wrapper
├── requirements.txt   # Dependencies
└── uploads/           # Temp storage
```

## Setup Instructions (for Developer)
1.  `pip install ultralytics opencv-python fastapi uvicorn python-multipart`
2.  Run with: `uvicorn main:app --reload --port 8000`
