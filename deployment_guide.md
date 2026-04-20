# Guide: Creative Studio Infrastructure Deployment (Manual Bypass)

This document summarizes the changes made and the steps required to successfully deploy the Creative Studio application in an environment where automated Cloud Build triggers (via GitHub integration) are bypassed. This guide can be used to reproduce the deployment in the customer's environment.

## Summary of Changes

To bypass the automated Cloud Build setup and resolve resulting Terraform dependency issues, we made the following modifications to the codebase:

### 1. Bootstrap Script (`bootstrap.sh`)
- **Bypassed Repository Setup**: Commented out the `setup_repo` step to avoid mandatory GitHub integration.
- **Non-interactive venv**: Added `--clear` flag to `uv venv` command to prevent interactive prompts during data seeding.

### 2. Terraform Module Modifications
- **Made Source Repository Optional**: Added `default = ""` to `source_repository_id` in both `cloud-run-service` and `firebase-hosting-service` modules.
- **Commented Missing Outputs**: Commented out `trigger_sa_email` output in both service modules since the trigger resource was not created.
- **Added Output**: Added `service_account_email` output to `cloud-run-service` module to export the Cloud Run service account email.

### 3. Platform Module (`infra/modules/platform/main.tf`)
- Commented out `source_repository_id` assignments in `backend_service` and `frontend_service` calls.
- Fixed secret accessors:
  - Commented out accessor for `frontend_secrets` (not needed for manual build).
  - Updated `backend_secrets` to use `module.backend_service.service_account_email` instead of the missing trigger SA.

### 4. Secret Manager Module (`infra/modules/secret-manager/`)
- Made `accessor_sa_email` optional with a default empty string.
- Made the IAM binding resource conditional on `accessor_sa_email != ""`.

---

## Reproduction Guide for Customer Environment

Follow these steps to replicate the successful deployment in a new environment.

### Prerequisites
- Ensure you are using the **`dna-infra`** branch containing the above fixes.
- Ensure the user running these commands in Cloud Shell has **Project Editor/Owner** permissions or equivalent IAM rights.

### Step 1: Initial Bootstrap
Run the bootstrap script to provision infrastructure (VPC, Cloud SQL, Secret Manager shells).
```bash
./bootstrap.sh
```
*Note: If it stops at Step 13 (Data Seeding) due to Cloud SQL proxy connection issues, temporarily enable Public IP on the Cloud SQL instance, run the seed step, and disable it again.*

### Step 2: Grant Required IAM Permissions
Since we are running builds and deploys manually from Cloud Shell (often falling back to the Default Compute Service Account), you must grant the following roles to the **Default Compute Service Account** (`[PROJECT_NUMBER]-compute@developer.gserviceaccount.com`):

```bash
# Replace [PROJECT_ID] and [PROJECT_NUMBER] with actual values

# 1. For reading source from GCS buckets during build
gcloud projects add-iam-policy-binding [PROJECT_ID] \
  --member="serviceAccount:[PROJECT_NUMBER]-compute@developer.gserviceaccount.com" \
  --role="roles/storage.objectViewer"

# 2. For pushing images to Artifact Registry
gcloud projects add-iam-policy-binding [PROJECT_ID] \
  --member="serviceAccount:[PROJECT_NUMBER]-compute@developer.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

# 3. For deploying to Cloud Run
gcloud projects add-iam-policy-binding [PROJECT_ID] \
  --member="serviceAccount:[PROJECT_NUMBER]-compute@developer.gserviceaccount.com" \
  --role="roles/run.admin"

# 4. For reading secrets during frontend build
gcloud projects add-iam-policy-binding [PROJECT_ID] \
  --member="serviceAccount:[PROJECT_NUMBER]-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# 5. For deploying to Firebase Hosting
gcloud projects add-iam-policy-binding [PROJECT_ID] \
  --member="serviceAccount:[PROJECT_NUMBER]-compute@developer.gserviceaccount.com" \
  --role="roles/firebase.admin"

# 6. For writing logs
gcloud projects add-iam-policy-binding [PROJECT_ID] \
  --member="serviceAccount:[PROJECT_NUMBER]-compute@developer.gserviceaccount.com" \
  --role="roles/logging.logWriter"
```

### Step 3: Deploy Backend Service
1. Modify `backend/cloudbuild.yaml` to replace `$SHORT_SHA` with `latest` (or a specific tag) to avoid empty tag errors during manual runs.
2. Run the build and deploy:
```bash
cd backend
gcloud run deploy creative-studio-backend --source . --region europe-north1 --quiet
```

### Step 4: Deploy Frontend Service
1. Get the Backend URL from the previous step.
2. Submit the frontend build with proper substitutions:
```bash
gcloud builds submit --config frontend/cloudbuild-deploy.yaml \
  --region=europe-north1 \
  --substitutions=_BACKEND_URL="[YOUR_BACKEND_URL]",_FE_SERVICE_NAME="[PROJECT_ID]",_BACKEND_SERVICE_ID="creative-studio-backend",_FIREBASE_SITE_ID="[PROJECT_ID]"
```

This should result in a fully functioning deployment!
