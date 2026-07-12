import express from "express";
import { searchTrains, autocomplete } from "../controllers/search.controller.js";

const router = express.Router();

// GET /search/trains?from=Delhi&to=Mumbai&date=2025-07-15
router.get('/trains' , searchTrains);

// GET /search/autocomplete?q=del
router.get('/autocomplete', autocomplete);

export default router;