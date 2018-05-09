#!/bin/sh

URL=/www/games/reduct-redux/docs
echo $URL

ssh root@lidavidm.me mkdir -p $URL
rsync -raP _build/html/* root@lidavidm.me:$URL/
