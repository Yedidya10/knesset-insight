-- Add image source tracking and attribution to members table
ALTER TABLE "members" ADD COLUMN "image_source" text;
ALTER TABLE "members" ADD COLUMN "image_attribution" text;
