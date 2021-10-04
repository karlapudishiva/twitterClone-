const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const app = express();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(4000, () => {
      console.log("server running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

const AuthenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid token");
  } else {
    jwt.verify(jwtToken, "shivasaiteja", async (error, user) => {
      if (error) {
        response.status(401);
        response.send("invalid token");
      } else {
        next();
      }
    });
  }
};

const validatePassword = (password) => {
  return password.length > 4;
};

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    const createUserQuery = `INSERT INTO
    user(username, password, name, gender)
    VALUES
    (
        '${username}',
        '${hashedPassword}',
        '${name}',
        '${gender}'
    );`;
    if (validatePassword(password)) {
      await db.run(createUserQuery);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("User invalid");
  } else {
    const isPasswordMatch = await bcrypt.compare(password, dbUser.password);

    if (isPasswordMatch === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "shivasaiteja");
      response.send({ jwtToken });
      response.send("Login Success");
    } else {
      response.status(400);
      response.send("invalid password");
    }
  }
});

app.get("/user/", AuthenticationToken, async (request, response) => {
  const getUserTweetsQuery = `SELECT 
        username,
        tweet,
        date_time
        FROM
    user inner join tweet on user.user_id = tweet.user_id;`;
  const userData = await db.get(getUserTweetsQuery);
  response.send(userData);
});

app.get("/user/following/", AuthenticationToken, async (request, response) => {
  const getUserFollowingQuery = `SELECT
    name
    FROM
    user inner join follower on user.user_id = follower.following_user_id;`;
  const userData = await db.all(getUserFollowingQuery);
  response.send(userData);
});

app.get("/tweets/:tweetId/", AuthenticationToken, async (request, response) => {
  const { tweetId } = request.params;
  const getTweetQuery = `SELECT 
  tweet,
  count(like.like_id) as likes,
  count(reply.reply_id) as replies,
  date_time
  FROM
  tweet left join like on tweet.tweet_id = like.tweet_id
  left join reply on reply.tweet_id = like.tweet_id
  WHERE
  tweet.tweet_id = ${tweetId};`;
  const tweet = await db.get(getTweetQuery);

  if (tweet === undefined) {
    response.status(401);
    response.send("invalid request");
  } else {
    response.send(tweet);
  }
});

app.get(
  "/tweets/:tweetId/likes/",
  AuthenticationToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const getTweetLikesQuery = `SELECT 
  count(like.like_id) as likes
  FROM
  tweet inner join like on 
  tweet.tweet_id = like.tweet_id
  WHERE
  tweet.tweet_id = ${tweetId};`;
    const tweet = await db.get(getTweetLikesQuery);
    if (tweet === undefined) {
      response.status(401);
      response.send("invalid request");
    } else {
      response.send(tweet);
    }
  }
);

app.get(
  "/tweets/:tweetId/replies/",
  AuthenticationToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const getTweetRepliesQuery = `SELECT 
  name,
  reply
  FROM
 user inner join tweet on user.user_id = tweet.user_id
 inner join reply on tweet.tweet_id = reply.tweet_id
  WHERE
  tweet.tweet_id = ${tweetId};`;
    const tweet = await db.get(getTweetRepliesQuery);

    if (tweet === undefined) {
      response.status(401);
      response.send("invalid request");
    } else {
      response.send(tweet);
    }
  }
);

app.get("/user/tweets/", AuthenticationToken, async (request, response) => {
  const getTweetsQuery = `SELECT 
  tweet,
  count(like.like_id) as likes,
  count(reply.reply_id) as replies,
  date_time
  FROM
  tweet left join like on tweet.tweet_id = like.tweet_id
  left join reply on reply.tweet_id = like.tweet_id;`;
  const tweets = await db.get(getTweetsQuery);
  response.send(tweets);
});

app.post("/user/tweets/", AuthenticationToken, async (request, response) => {
  const { tweet } = request.body;
  const addTweetQuery = `
  INSERT INTO
  tweet(tweet)
  VALUES
  (
    '${tweet}'
  );`;
  const dbResponse = await db.run(addTweetQuery);
  response.send("created a tweet");
});

app.delete(
  "/tweets/:tweetId/",
  AuthenticationToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const deleteTweetQuery = `
  DELETE FROM
  tweet
  WHERE
  tweet.tweet_id = ${tweetId};`;
    await db.run(deleteTweetQuery);
    response.send("tweet deleted successfully");
  }
);

module.exports = app;
