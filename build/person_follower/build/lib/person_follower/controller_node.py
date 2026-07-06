import rclpy
import math
from rclpy.node import Node
from geometry_msgs.msg import PointStamped, Twist
from nav_msgs.msg import Odometry


class ControllerNode(Node):

    def __init__(self):
        super().__init__('controller_node')

        self.subscription = self.create_subscription(
            PointStamped,
            '/person_position',
            self.position_callback,
            10
        )

        self.cmd_publisher = self.create_publisher(Twist, '/cmd_vel', 10)
        self.odom_publisher = self.create_publisher(Odometry, '/odom', 10)

        self.odom_timer = self.create_timer(0.05, self.publish_odom)

        self.max_angular_speed = 1.5
        self.max_linear_speed = 0.6
        self.keep_distance = 1.2

        self.pos_x = 0.0
        self.pos_y = 0.0
        self.yaw = 0.0
        self.current_lin = 0.0
        self.current_ang = 0.0

        self.get_logger().info('Controller Node has started!')

    def position_callback(self, msg):
        cmd = Twist()

        person_x = msg.point.x
        person_y = msg.point.y
        distance = math.hypot(person_x, person_y)

        if distance < 0.01:
            cmd.linear.x = 0.0
            cmd.angular.z = 0.0
            self.get_logger().info('No person detected - stopping')
        else:
            bearing = math.atan2(person_y, person_x)
            cmd.angular.z = 1.5 * bearing
            cmd.angular.z = max(-self.max_angular_speed,
                                min(self.max_angular_speed, cmd.angular.z))

            if distance > self.keep_distance:
                cmd.linear.x = min(self.max_linear_speed,
                                   0.6 * (distance - self.keep_distance))
            else:
                cmd.linear.x = 0.0

            self.get_logger().info(
                f'Dist: {distance:.2f}m, '
                f'Bear: {math.degrees(bearing):.1f}°, '
                f'Lin: {cmd.linear.x:.2f}, '
                f'Ang: {cmd.angular.z:.2f}'
            )

        self.current_lin = cmd.linear.x
        self.current_ang = cmd.angular.z
        self.cmd_publisher.publish(cmd)

    def publish_odom(self):
        dt = 0.05
        self.yaw += self.current_ang * dt
        self.pos_x += self.current_lin * math.cos(self.yaw) * dt
        self.pos_y += self.current_lin * math.sin(self.yaw) * dt

        odom = Odometry()
        odom.header.stamp = self.get_clock().now().to_msg()
        odom.header.frame_id = 'odom'
        odom.child_frame_id = 'base_link'

        odom.pose.pose.position.x = self.pos_x
        odom.pose.pose.position.y = self.pos_y

        half_yaw = self.yaw / 2.0
        odom.pose.pose.orientation.z = math.sin(half_yaw)
        odom.pose.pose.orientation.w = math.cos(half_yaw)

        odom.twist.twist.linear.x = self.current_lin
        odom.twist.twist.angular.z = self.current_ang

        self.odom_publisher.publish(odom)


def main():
    rclpy.init()
    node = ControllerNode()
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
