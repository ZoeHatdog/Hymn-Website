import type { NextFunction, Request, Response } from "express";
import { readRequestSession } from "./session.ts";

export function requireSession(req: Request, res: Response, next: NextFunction) {
  try {
    const session = readRequestSession(req);
    if (!session) {
      res.status(401).json({ success: false, error: "Sign in to change the library." });
      return;
    }
    res.locals.session = session;
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Sign-in is not configured." });
  }
}
