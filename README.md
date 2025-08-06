# Skywell
an atproto-based file sharing service

[Basic concept design](https://www.tldraw.com/p/Phl3cnqDD3YdLVleH8O6r?d=v230.51.2695.1036.page)

Config notes for nginx:
Go server (xrpc routes) should be on port 4999
Website should be on port 5000

```nginx
server {
	listen 80;
	server_name skywell.dev;

	return 301 https://$host$request_uri;
}

server {
	listen 443;
	server_name skywell.dev;

	location / {
		proxy_pass http://127.0.0.1:5000;
		proxy_http_version 1.1;
		proxy_set_header Upgrade $http.upgrade;
		proxy_set_header Connection "upgrade";
		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;
	}

	location /xrpc/ {
		proxy_pass http://127.0.0.1:4999/xrpc/;
		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;
	}
}
```
