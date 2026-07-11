import json
import boto3

bedrock = boto3.client(service_name="bedrock-runtime", region_name="us-east-1")

def lambda_handler(event, context):
    try:
        body = json.loads(event.get("body", "{}"))
        raw_tasks = body.get("rawTasks", "")
        
        if not raw_tasks:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "No tasks provided"})
            }

        prompt = f"""You are an elite productivity assistant. Take the following raw task list and return a clean JSON array of objects. Each object must have keys: "task", "priority" (High/Medium/Low), "impact", and "immediateNextStep".
        
        Raw Tasks: {raw_tasks}"""

        payload = {
            "inferenceConfig": {
                "maxTokens": 1000,
                "temperature": 0.3
            },
            "messages": [
                {
                    "role": "user",
                    "content": [{"text": prompt}]
                }
            ]
        }

        response = bedrock.invoke_model(
            modelId="amazon.nova-lite-v1:0",
            contentType="application/json",
            accept="application/json",
            body=json.dumps(payload)
        )


        response_body = json.loads(response.get("body").read().decode("utf-8"))
        ai_output = response_body["output"]["message"]["content"][0]["text"]

        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "OPTIONS,POST"
            },
            "body": ai_output
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps({"error": str(e)})
        }