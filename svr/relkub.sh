#!/bin/bash

pkg -t node10-linux-x64 app.js
mv ./app ../tmp/
cd ../tmp/

CMD=$(cat <<-END
sudo supervisorctl restart paymgr
#node app.js

END
)
# need first stop app and then copy
scp -r * kub:/data/apps/paymgr/
ssh kub "$CMD"

# [program:paymgr]
# directory=/data/apps/paymgr/
# command=/data/apps/paymgr/app
# autostart=true
# autorestart=true

# sudo supervisorctl reread
# sudo supervisorctl update
# sudo supervisorctl start paymgr