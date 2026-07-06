from launch import LaunchDescription
from launch_ros.actions import Node


def generate_launch_description():
    return LaunchDescription([
        Node(
            package='person_follower',
            executable='camera_node',
            name='camera_node',
            output='screen'
        ),
        Node(
            package='person_follower',
            executable='detector_node',
            name='detector_node',
            output='screen'
        ),
        Node(
            package='person_follower',
            executable='controller_node',
            name='controller_node',
            output='screen'
        ),
        Node(
            package='person_follower',
            executable='viewer_node',
            name='viewer_node',
            output='screen'
        ),
    ])
