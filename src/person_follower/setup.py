from setuptools import find_packages, setup
import os
from glob import glob

package_name = 'person_follower'

setup(
    name=package_name,
    version='0.0.0',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages',
            ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
        (os.path.join('share', package_name, 'launch'),
            glob(os.path.join('launch', '*.py'))),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='chidanand',
    maintainer_email='chidanand@todo.todo',
    description='TODO: Package description',
    license='TODO: License declaration',
    extras_require={
        'test': [
            'pytest',
        ],
    },
    entry_points={
        'console_scripts': [
            'follower_node = person_follower.follower_node:main',
            'listener_node = person_follower.listener_node:main',
            'camera_node = person_follower.camera_node:main',
            'viewer_node = person_follower.viewer_node:main',
            'detector_node = person_follower.detector_node:main',
            'controller_node = person_follower.controller_node:main',
        ],
    },
)
