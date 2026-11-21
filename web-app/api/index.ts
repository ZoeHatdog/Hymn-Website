import express, { type Request, type Response, type NextFunction } from "express";
import "dotenv/config";
import { goodCursor } from "./includes/good_cursor.ts";
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

goodCursor.init();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    });

app.use((req: Request, res: Response, next: NextFunction) => {
    const started = Date.now();
    res.on("finish", () => {
      const ms = Date.now() - started;
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
    });
    next();
  });





app.get("/", (req, res) => {
    res.send("Hello World");
});

app.get("/:model/:method", (req, res) => {});

export default app;