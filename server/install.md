yum update
yum install golang

// Open port
firewall-cmd --permanent --add-port=8123/tcp
firewall-cmd --reload
