import rclpy
from rclpy.node import Node

from sensor_msgs.msg import Image
from cv_bridge import CvBridge

import cv2


class ViewerNode(Node):

    def __init__(self):
        super().__init__('viewer_node')

        self.subscription = self.create_subscription(
            Image,
            '/detection_image',
            self.image_callback,
            10
        )

        self.bridge = CvBridge()

        self.get_logger().info('Viewer Node has started!')

    def image_callback(self, msg):
        frame = self.bridge.imgmsg_to_cv2(
            msg,
            desired_encoding='bgr8'
        )

        cv2.imshow(
            'Camera Feed',
            frame
        )

        cv2.waitKey(1)

    def destroy_node(self):
        cv2.destroyAllWindows()

        super().destroy_node()


def main():
    rclpy.init()

    node = ViewerNode()

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
