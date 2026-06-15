import asyncio
import os
import sys

# Add backend root to python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))


from src.database import WorkerDatabase
from src.images.imagen_service import ImagenService
from src.images.repository.media_item_repository import MediaRepository
from src.brand_guidelines.repository.brand_guideline_repository import BrandGuidelineRepository
from src.multimodal.gemini_service import GeminiService
from src.common.storage_service import GcsService
from src.source_assets.repository.source_asset_repository import SourceAssetRepository
from src.auth.iam_signer_credentials_service import IamSignerCredentials

async def main():
    async with WorkerDatabase() as db_factory:
        async with db_factory() as db:
            media_repo = MediaRepository(db)
            gcs_service = GcsService()
            source_asset_repo = SourceAssetRepository(db)
            brand_guideline_repo = BrandGuidelineRepository(db)
            gemini_service = GeminiService(brand_guideline_repo=brand_guideline_repo)
            iam_signer_credentials = IamSignerCredentials()
            
            imagen_service = ImagenService(
                iam_signer_credentials=iam_signer_credentials,
                media_repo=media_repo,
                gemini_service=gemini_service,
                gcs_service=gcs_service,
                source_asset_repo=source_asset_repo,
                brand_guideline_repo=brand_guideline_repo
            )
            
            print("Successfully initialized services and repositories!")
            
            # --- Check Database Connection Availability ---
            from sqlalchemy.exc import OperationalError, InterfaceError
            from sqlalchemy import select
            from src.common.schema.media_item_model import MediaItem
            
            db_active = False
            items = []
            try:
                result = await db.execute(select(MediaItem).limit(10))
                items = result.scalars().all()
                db_active = True
            except Exception as conn_error:
                print(f"\n⚠️ Database connection not available: {conn_error}")
                print("Switching to Mocked Unit Test mode to verify orchestration logic...")

            if db_active:
                if not items:
                    print("No media items found in the database.")
                    return
                    
                print("\nFound the following media items:")
                for idx, item in enumerate(items):
                    print(f"[{idx}] ID: {item.id}, Workspace: {item.workspace_id}, Model: {item.model}, URIs: {item.gcs_uris}")
                
                # Let's find one with valid workspace and gcs_uris
                target_item = None
                for item in items:
                    if item.gcs_uris and item.workspace_id:
                        target_item = item
                        break
                
                if target_item:
                    print(f"\nRunning compliance check on media item {target_item.id} in workspace {target_item.workspace_id}...")
                    try:
                        updated_item = await imagen_service.check_image_compliance(
                            media_item_id=target_item.id,
                            workspace_id=target_item.workspace_id,
                            media_index=0
                        )
                        print("\nCompliance Check Succeeded!")
                        print("Updated raw_data brand_compliance value:")
                        print(updated_item.raw_data.get("brand_compliance"))
                    except Exception as e:
                        print(f"\nCompliance Check failed: {e}")
                else:
                    print("\nNo media item found with valid workspace and gcs_uris for test execution.")
            else:
                # --- MOCKED UNIT TEST VERIFICATION ---
                from unittest.mock import AsyncMock, MagicMock
                
                # 1. Mock media_item fetch
                mock_media_item = MagicMock()
                mock_media_item.id = 123
                mock_media_item.workspace_id = 456
                mock_media_item.gcs_uris = ["gs://my-bucket/generated_image.png"]
                # Mock mime_type to be a string or object that acts like string
                mock_media_item.mime_type = "image/png"
                mock_media_item.raw_data = {"existing_key": "value"}
                
                media_repo.get_by_id = AsyncMock(return_value=mock_media_item)
                media_repo.update = AsyncMock()
                
                # 2. Mock brand guideline fetch
                mock_guideline = MagicMock()
                mock_guideline.source_pdf_gcs_uris = ["gs://my-bucket/brand_guidelines.pdf"]
                
                mock_query_response = MagicMock()
                mock_query_response.data = [mock_guideline]
                brand_guideline_repo.query = AsyncMock(return_value=mock_query_response)
                
                # 3. Mock Gemini Service response
                mock_report = {
                    "is_compliant": True,
                    "detailed_reason": "Mocked validation: Asset adheres perfectly to the style guidelines."
                }
                gemini_service.check_brand_compliance = MagicMock(return_value=mock_report)
                
                print("\n--- Running Mocked Orchestration Check ---")
                
                # Execute compliance check
                updated_item = await imagen_service.check_image_compliance(
                    media_item_id=123,
                    workspace_id=456,
                    media_index=0
                )
                
                print("\nMocked Execution Succeeded!")
                print("1. Fetched guidelines PDF path:", mock_guideline.source_pdf_gcs_uris[0])
                print("2. Evaluated asset path:", mock_media_item.gcs_uris[0])
                print("3. Gemini compliance analysis output:", mock_report)
                print("4. Updated raw_data passed to database:")
                print(media_repo.update.call_args[0][1])
                
                # Assertions to verify correctness
                assert media_repo.update.call_count == 1
                media_repo.update.assert_called_once_with(123, {"raw_data": {
                    "existing_key": "value",
                    "brand_compliance": {
                        "0": mock_report
                    }
                }})
                print("\n✅ Verification Successful: Orchestration logic and mock assertions passed!")


if __name__ == "__main__":
    asyncio.run(main())
