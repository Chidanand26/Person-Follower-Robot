import rclpy
from rclpy.node import Node
from sensor_msgs.msg import Image
from geometry_msgs.msg import PointStamped
from cv_bridge import CvBridge
from ultralytics import YOLO
import cv2


class DetectorNode(Node):

    def __init__(self):
        super().__init__('detector_node')

        self.subscription = self.create_subscription(
            Image,
            '/image_raw',
            self.image_callback,
            10
        )

        self.image_publisher = self.create_publisher(Image, '/detection_image', 10)
        self.position_publisher = self.create_publisher(PointStamped, '/person_position', 10)

        self.bridge = CvBridge()

        # Load the YOLOv8 nano model (downloaded earlier to yolov8n.pt)
        self.model = YOLO('yolov8n.pt')
        # In COCO, class 0 is 'person' — we only care about that
        self.person_class_id = 0
        self.confidence_threshold = 0.5

        self.frame_width = 640
        self.camera_fov = 1.2

        self.get_logger().info('YOLO Detector Node has started!')

    def image_callback(self, msg):
        frame = self.bridge.imgmsg_to_cv2(msg, desired_encoding='bgr8')

        # Run YOLO. verbose=False silences the per-frame console spam.
        # classes=[0] tells YOLO to only look for people — faster.
        results = self.model(frame, verbose=False, classes=[self.person_class_id])

        position_msg = PointStamped()
        position_msg.header.stamp = self.get_clock().now().to_msg()
        position_msg.header.frame_id = 'base_link'

        best_box = None
        best_area = 0.0

        # results[0].boxes holds every detection in this frame
        for box in results[0].boxes:
            confidence = float(box.conf[0])
            if confidence < self.confidence_threshold:
                continue
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            area = (x2 - x1) * (y2 - y1)
            if area > best_area:
                best_area = area
                best_box = (x1, y1, x2, y2, confidence)

        if best_box is not None:
            x1, y1, x2, y2, conf = best_box

            cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 0), 2)
            cv2.putText(frame, f'Person {conf:.2f}', (int(x1), int(y1) - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)

            center_x = (x1 + x2) / 2.0
            estimated_distance = max(0.5, 150000.0 / best_area) if best_area > 0 else 5.0
            bearing = -((center_x / self.frame_width) - 0.5) * self.camera_fov

            position_msg.point.x = estimated_distance
            position_msg.point.y = estimated_distance * bearing
        else:
            position_msg.point.x = 0.0
            position_msg.point.y = 0.0

        self.position_publisher.publish(position_msg)

        detection_msg = self.bridge.cv2_to_imgmsg(frame, encoding='bgr8')
        self.image_publisher.publish(detection_msg)


def main():
    rclpy.init()
    node = DetectorNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == '__main__':
    main()
