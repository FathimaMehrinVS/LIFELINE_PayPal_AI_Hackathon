import { Router } from "express";
import { ApproveAllocationRequestSchema } from "@lifeline/contracts";
import { validateBody } from "../middleware/validate";
import { notImplemented } from "./not-implemented";

// Owner: Member 2 (feature/financial-intelligence)
export const allocationRouter = Router();

allocationRouter.post("/approve", validateBody(ApproveAllocationRequestSchema), notImplemented("Allocation approval"));
