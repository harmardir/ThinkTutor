import boto3
import json
import logging

class BedrockClient:
    def __init__(self, region_name):
        self.client = boto3.client("bedrock-runtime", region_name=region_name)
        logging.basicConfig(level=logging.INFO)

    def generate_text(self, model_id, prompt, max_tokens=300):
        body = {
            "inputText": prompt,
            "textGenerationConfig": {
                "maxTokenCount": max_tokens,
                "temperature": 0.7,
                "topP": 0.9,
                "stopSequences": []
            }
        }

        response = self.client.invoke_model(
            modelId=model_id,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(body)
        )

        response_body = json.loads(response["body"].read())
        output_text = response_body.get("results", [{}])[0].get("outputText", "")

        # Estimate token usage and cost (rough approximation)
        input_tokens = len(prompt.split())
        output_tokens = len(output_text.split())
        estimated_cost = (input_tokens * 0.0004 + output_tokens * 0.0015) / 1000

        logging.info(f"Prompt tokens: {input_tokens}, Output tokens: {output_tokens}")
        logging.info(f"Estimated cost: ${estimated_cost:.6f}")

        return output_text

