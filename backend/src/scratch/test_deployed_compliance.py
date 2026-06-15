import httpx
import sys
import subprocess

def get_iap_token(client_id: str) -> str:
    """Uses gcloud to print an identity token with the IAP client ID as audience."""
    try:
        cmd = ["gcloud", "auth", "print-identity-token", f"--audiences={client_id}"]
        token = subprocess.check_output(cmd).decode("utf-8").strip()
        return token
    except Exception as e:
        print(f"Failed to retrieve OIDC token via gcloud: {e}")
        print("Please ensure you are logged in using: gcloud auth login")
        sys.exit(1)

def main():
    if len(sys.argv) < 5:
        print("Usage: python3 test_deployed_compliance.py <BACKEND_URL> <IAP_CLIENT_ID> <MEDIA_ITEM_ID> <WORKSPACE_ID>")
        print("\nExample:")
        print("  python3 test_deployed_compliance.py https://cstudio-be-xxxxx-uc.a.run.app 123456-abcdef.apps.googleusercontent.com 12 4")
        sys.exit(1)

    backend_url = sys.argv[1].rstrip('/')
    iap_client_id = sys.argv[2]
    media_item_id = sys.argv[3]
    workspace_id = sys.argv[4]

    # Generate IAP Token
    print("Generating IAP OIDC access token...")
    token = get_iap_token(iap_client_id)

    # API Request configuration
    request_url = f"{backend_url}/api/images/{media_item_id}/check-compliance"
    params = {
        "workspace_id": workspace_id,
        "media_index": 0
    }
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    print(f"\nSending POST request to: {request_url}")
    print(f"Params: {params}")
    
    try:
        response = httpx.post(request_url, params=params, headers=headers, timeout=60.0)
        print(f"\nResponse Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("\nVerification Succeeded!")
            print("Brand Compliance Report in raw_data:")
            print(data.get("rawData", {}).get("brand_compliance"))
        else:
            print("\nError response:")
            print(response.text)
            
    except Exception as e:
        print(f"\nHTTP Request failed: {e}")

if __name__ == "__main__":
    main()
