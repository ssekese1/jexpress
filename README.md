Installing

npm install
npm start

GET http://worker.10layer.com:3003/bootstrap

POST 
{
    "__v": 0,
    "apikey": "AABZPemEWm7FI0ic",
    "user_id": "545666f5d65d76d303079730",
    "_id": "5456675dd65d76d303079732",
    "created": "2014-11-02T17:18:21.232Z"
}

PUT http://worker.10layer.com:3003/api/user/545666f5d65d76d303079730?apikey=AABZPemEWm7FI0ic
password: blah

{
    "message": "user updated ",
    "data": {
        "password": "$2a$04$aXXGdNGvKY9ko9zrdUVWj.ZA8M6QaSIywztMXKLrmRn.fr22LNfoy",
        "admin": true,
        "email": "admin",
        "name": "Admin",
        "_id": "545666f5d65d76d303079730",
        "__v": 0
    }
}