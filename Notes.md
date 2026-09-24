## Versions of the Application.

v1: 
A skeleton. The app has very basic feature of adding an expense and looking at the list of expenses.
Has a FastAPI backend, PostgreSQL database and React and Typescript on the frontend

v2:
The app is hosted on AWS using EC2 instance. The steps involved were:
- Create and launch an EC2 instance.
- The config should allow only SSH from myIP and CustomTCP to 8080 port. That's it.
- SSH into the application through Windows Terminal
- Download and install docker and docker-compose
- Clone my repo from Github.
- Do a docker-compose up --build
- App is live at <Server IP>:8080

To make any changes to the application:
- Push the changes to the Github repo
- Do a git pull in the server.
- Do a docker-compose up --build again to build using the changed code.
- Modified app is live at: <Server IP>:8080

