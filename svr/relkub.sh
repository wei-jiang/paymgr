#!/bin/bash
# --exclude='*.map'

tar --exclude='./node_modules' --exclude='./.vscode' --exclude='./relkub.sh' \
 --exclude='./paymgr.tar.gz' --exclude='./.git' \
 -zcvf paymgr.tar.gz . 

CMD=$(cat <<-END
set -x
cd /data/apps/paymgr
tar zxvf ./paymgr.tar.gz -C .
npm i
#node app.js
pm2 reload paymgr
END
)

scp ./paymgr.tar.gz kub:/data/apps/paymgr/
ssh kub "$CMD"