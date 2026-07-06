import rclpy
from rclpy.node import Node
from std_msgs.msg import String


class ListenerNode(Node):

    def __init__(self):
        super().__init__('listener_node')
        self.subscription = self.create_subscription(
            String,
            '/status',
            self.listener_callback,
            10
        )
        self.get_logger().info('Listener Node has started!')

    def listener_callback(self, msg):
        self.get_logger().info(f'I heard: {msg.data}')


def main():
    rclpy.init()
    node = ListenerNode()
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
