import rclpy
from rclpy.node import Node
from std_msgs.msg import String


class FollowerNode(Node):

    def __init__(self):
        super().__init__('follower_node')

        self.publisher = self.create_publisher(String, '/status', 10)
        self.timer = self.create_timer(1.0, self.timer_callback)

        self.counter = 0

        self.get_logger().info('Person Follower Node has started!')

    def timer_callback(self):
        msg = String()

        msg.data = f'Hello from follower node: {self.counter}'

        self.publisher.publish(msg)

        self.get_logger().info(f'Published: {msg.data}')

        self.counter += 1


def main():
    rclpy.init()

    node = FollowerNode()

    try:
        rclpy.spin(node)

    except KeyboardInterrupt:
        pass

    finally:
        node.destroy_node()

        if rclpy.ok():
            rclpy.shutdown()


if __name__ == "__main__":
    main()
