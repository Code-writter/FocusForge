# ⚡ FocusForge
<img width="1200" height="630" alt="banner" src="https://github.com/user-attachments/assets/d07c2f07-703d-471a-b675-8f7ba12e4146" />

**AI-Powered Task Triage via Amazon Bedrock**

FocusForge is a serverless, AI-driven productivity application designed to eliminate decision fatigue. It takes chaotic, unorganized text dumps of everything on your mind—emails, ideas, bugs, reminders—and transforms them into a highly structured, prioritized execution matrix.

Built as a submission for the **AWS Build a Productivity App Weekend Challenge**.

---

## ✨ Features

* **Brain-Dump Interface:** A clean, distraction-free text area to unload all pending tasks and thoughts.
* **Intelligent Triage:** Leverages Amazon Bedrock (Nova Lite) to instantly categorize tasks by Priority (High/Medium/Low) and Impact.
* **Action Bias:** Generates a specific, executable "Immediate Next Step" for every identified task to break procrastination.
* **Premium Dark Mode UI:** Built with React and pure inline CSS for a sleek, responsive, and modern SaaS aesthetic.
* **100% Serverless:** Highly scalable and cost-efficient architecture running entirely on AWS Free Tier services.

---

## 🏗️ Architecture & Tech Stack

FocusForge uses a decoupled, serverless architecture:

* **Frontend:** React (Vite) hosted as a static website on **Amazon S3**.
* **API Routing:** **AWS API Gateway** (HTTP API) handling cross-origin requests (CORS) and routing.
* **Compute:** **AWS Lambda** (Python 3.12) acting as the secure backend processor.
* **AI Engine:** **Amazon Bedrock** using the highly efficient `amazon.nova-lite-v1:0` foundation model.

### System Flow
`React UI` ──(POST Request)──> `AWS API Gateway` ──(Event)──> `AWS Lambda` ──(Boto3 Invoke)──> `Amazon Bedrock`

---

## 🚀 Getting Started (Local Development)

### Prerequisites
* Node.js (v18+)
* An active AWS Account
* Access enabled for the **Amazon Nova Lite** model in the Amazon Bedrock console.

### 1. Backend Setup (AWS)
1.  **Lambda:** Create a Python 3.12 Lambda function and paste the backend code from this repository.
2.  **IAM Permissions:** Attach the `AmazonBedrockFullAccess` policy to the Lambda execution role.
3.  **API Gateway:** Create an HTTP API, configure a `POST` route (`/prioritize`), and point it to your Lambda function.
4.  **CORS:** Enable CORS in API Gateway for the `*` origin, `POST`/`OPTIONS` methods, and `content-type` headers. Deploy the API.

### 2. Frontend Setup (Local)
1.  Clone this repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Open `src/App.tsx` and replace the `API_ENDPOINT` variable with your live AWS API Gateway URL.
4.  Start the development server:
    ```bash
    npm run dev
    ```

---

## ☁️ Deployment

FocusForge's frontend is designed to be hosted statically on Amazon S3.

1.  Build the production application:
    ```bash
    npm run build
    ```
2.  Create an Amazon S3 Bucket and disable "Block all public access".
3.  Enable **Static website hosting** on the bucket (set index document to `index.html`).
4.  Apply a public read bucket policy:
    ```json
    {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "PublicReadGetObject",
                "Effect": "Allow",
                "Principal": "*",
                "Action": "s3:GetObject",
                "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
            }
        ]
    }
    ```
5.  Upload the contents of the generated `dist/` folder into your S3 bucket.
6.  Your app is now live at the S3 Website Endpoint!

---

## 🛡️ License

Distributed under the MIT License. See `LICENSE` for more information.
