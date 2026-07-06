import rclpy
from rclpy.node import Node
from sensor_msgs.msg import Image, CompressedImage
from cv_bridge import CvBridge
import cv2


class CameraNode(Node):

    def __init__(self):
        super().__init__('camera_node')

        self.publisher = self.create_publisher(Image, '/image_raw', 10)
        self.compressed_publisher = self.create_publisher(
            CompressedImage, '/camera/image/compressed', 10)

        self.timer = self.create_timer(0.1, self.timer_callback)
        self.cap = cv2.VideoCapture(0)
        self.bridge = CvBridge()

        if not self.cap.isOpened():
            self.get_logger().error('Failed to open camera!')
        else:
            self.get_logger().info('Camera Node has started!')

    def timer_callback(self):
        ret, frame = self.cap.read()

        if ret:
            msg = self.bridge.cv2_to_imgmsg(frame, encoding='bgr8')
            self.publisher.publish(msg)

            compressed_msg = CompressedImage()
            compressed_msg.header.stamp = self.get_clock().now().to_msg()
            compressed_msg.format = 'jpeg'
            compressed_msg.data = bytes(cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 50])[1])
            self.compressed_publisher.publish(compressed_msg)
        else:
            self.get_logger().warn('Failed to capture frame')

    def destroy_node(self):
        self.cap.release()
        super().destroy_node()


def main():
    rclpy.init()
    node = CameraNode()
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
