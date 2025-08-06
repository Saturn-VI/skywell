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
	listen 443 ssl http2;
	server_name skywell.dev;

	ssl_certificate /keys/fullchain.pem;
	ssl_certificate_key /keys/privkey.pem;

	ssl_protocols TLSv1.2 TLSv1.3;
	ssl_ciphers 'TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384';

	location / {
		proxy_pass http://127.0.0.1:5000;
		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
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
