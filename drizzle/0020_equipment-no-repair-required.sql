-- Allow equipment requests without a repair job
ALTER TABLE "part_requests" ALTER COLUMN "repair_job_id" DROP NOT NULL;
