# Person Follower Robot

My first ROS2 project — a robot that detects a person with a camera and follows them, built end to end with ROS2 Jazzy and Python. Since I don't have hardware yet, it runs in simulation and is visualized through a browser-based 3D digital twin connected over rosbridge.

## Overview/architecture

```
USB Camera ──> camera_node ──/image_raw──> detector_node ──/person_position──> controller_node ──/cmd_vel──> Robot
                    │                            (YOLOv8)                          (proportional          │
                    │                                                                 control)            │
                    └──/camera/image/compressed──┐                    ┌──/odom───────────────────────────┘
                                                 v                    v
                                          rosbridge (WebSocket) ──> Web 3D Digital Twin (Three.js)
```

The nodes communicate only through ROS2 topics, so each one is independent. At one point I swapped the detector from HOG to YOLOv8 and no other node had to change — that is the value of clean message interfaces.

## Demo

https://github.com/user-attachments/assets/aeb14cbf-9843-4069-89c1-e0a88eb6b34a

The demo shows the complete ROS2 person-following pipeline running in simulation:
- Laptop webcam publishes live frames through `camera_node`
- YOLOv8 detects and tracks the person
- `controller_node` generates `/cmd_vel` commands using proportional control
- Robot movement and telemetry are visualized in the Three.js digital twin through rosbridge

## Stack

- **ROS2 Jazzy**, **Python** (rclpy)
- **OpenCV** + **cv_bridge** for image capture and conversion
- **YOLOv8** (Ultralytics) for person detection
- **Three.js** + **rosbridge** (rosbridge_suite) for the web digital twin

## ROS2 Package (`src/person_follower`)

| Node | Subscribes | Publishes | Job |
|------|-----------|-----------|-----|
| `camera_node` | — | `/image_raw` (Image), `/camera/image/compressed` (CompressedImage) | Capture webcam frames with OpenCV |
| `detector_node` | `/image_raw` | `/person_position` (PointStamped), `/detection_image` (Image) | Run YOLOv8, pick the closest person, estimate position in `base_link` frame |
| `controller_node` | `/person_position` | `/cmd_vel` (Twist), `/odom` (Odometry) | Proportional control: steer toward the person, hold a target distance |
| `viewer_node` | `/detection_image` | — | Show the detection feed with bounding boxes |

Proportional control: the robot turns harder the more the person is off-center, and slows as it reaches the keep-distance. The controller also integrates a simple unicycle motion model and publishes odometry (with yaw-to-quaternion conversion) so the digital twin can render the robot moving.

## Web Digital Twin (`neon_twin/`)

A static web dashboard that talks to the ROS2 nodes over a WebSocket through rosbridge. It renders a 3D twin from `/odom` in real time, streams the compressed camera feed, draws the tracked person, and lets you drive the robot and switch modes (manual / person-follow / autonomous / stop) from the browser. It also runs in a standalone simulation mode with no ROS connection.

## Running It

Build the workspace:

```bash
cd person_follower_ws
colcon build
source install/setup.bash
```

Launch the full pipeline:

```bash
ros2 launch person_follower person_follower_launch.py
```

Run the web dashboard (in two more terminals):

```bash
# rosbridge (WebSocket bridge)
ros2 launch rosbridge_server rosbridge_websocket_launch.xml

# serve the dashboard
cd neon_twin && python3 -m http.server 8000
```

Open `http://localhost:8000` and click **Establish Link**.

## Notes / Things I Learned

- Coordinate frames (REP-103) and converting yaw angles to quaternions for odometry.
- Clean topic interfaces let me replace the whole detection backend (HOG → YOLOv8) without touching downstream nodes.
- Real-world environment debugging on Ubuntu 24.04: pip's externally-managed-environment (PEP 668) needs `--break-system-packages`; keep `numpy<2`; do **not** install pip `opencv-python`, as it shadows the system OpenCV that `cv_bridge` is built against.
- `yolov8n.pt` downloads automatically on first run if it is not present.

## Next Steps

Move from simulation to real hardware, step by step.
