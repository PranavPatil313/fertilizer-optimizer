#!/usr/bin/env python3
"""
Test script to verify the training job cancellation fix.
This simulates the scenario where a job appears as "running" in the UI
but cannot be cancelled due to missing cancellation event.
"""

import asyncio
import sys
from datetime import datetime
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Add src to path
sys.path.insert(0, 'src')

from src.db.models import Base, TrainingJob, Dataset
from src.db.session import AsyncSessionLocal, get_async_database_url
from src.services.training import cancel_training_job, run_training_job, _running_jobs


async def setup_test_database():
    """Create test database and tables."""
    print("Setting up test database...")
    database_url = get_async_database_url()
    engine = create_async_engine(database_url, echo=False)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    
    return engine


async def create_test_job(session: AsyncSession, status="pending"):
    """Create a test training job."""
    # First create a dataset
    dataset = Dataset(
        filename="test_dataset.csv",
        original_filename="test.csv",
        file_hash="test_hash",
        status="processed",
        row_count=100,
        size_bytes=1024,
        uploaded_at=datetime.utcnow()
    )
    session.add(dataset)
    await session.flush()
    
    # Create training job
    job = TrainingJob(
        status=status,
        created_at=datetime.utcnow(),
        dataset_ids=[dataset.id],
        log="Test job"
    )
    session.add(job)
    await session.commit()
    
    print(f"Created test job #{job.id} with status '{status}'")
    return job.id


async def test_cancellation_without_event():
    """Test cancelling a job that doesn't have a cancellation event."""
    print("\n=== Test 1: Cancelling job without cancellation event ===")
    
    async with AsyncSessionLocal() as session:
        job_id = await create_test_job(session, status="pending")
    
    # Simulate the bug: job is pending but no event in _running_jobs
    # This happens when job is pending but hasn't started running yet
    print(f"Job #{job_id} is pending, _running_jobs contains: {list(_running_jobs.keys())}")
    
    # Try to cancel - should succeed even without event
    result = await cancel_training_job(job_id)
    print(f"cancel_training_job returned: {result}")
    
    # Check job status
    async with AsyncSessionLocal() as session:
        job = await session.get(TrainingJob, job_id)
        print(f"Job status after cancellation: {job.status}")
        print(f"Job log: {job.log}")
    
    assert result == True, "Cancellation should succeed"
    assert job.status == "cancelled", "Job should be marked as cancelled"
    print("✓ Test 1 passed: Job can be cancelled even without cancellation event")


async def test_cancellation_with_event():
    """Test cancelling a job that has a cancellation event."""
    print("\n=== Test 2: Cancelling job with cancellation event ===")
    
    async with AsyncSessionLocal() as session:
        job_id = await create_test_job(session, status="pending")
    
    # Manually create an event (simulating job that has started)
    import threading
    event = threading.Event()
    _running_jobs[job_id] = event
    
    print(f"Job #{job_id} has event in _running_jobs")
    
    # Try to cancel
    result = await cancel_training_job(job_id)
    print(f"cancel_training_job returned: {result}")
    
    # Check event was set
    print(f"Event is_set: {event.is_set()}")
    
    # Check job status
    async with AsyncSessionLocal() as session:
        job = await session.get(TrainingJob, job_id)
        print(f"Job status after cancellation: {job.status}")
    
    assert result == True, "Cancellation should succeed"
    assert job.status == "cancelled", "Job should be marked as cancelled"
    assert event.is_set(), "Event should be set"
    print("✓ Test 2 passed: Job with event can be cancelled")


async def test_cancellation_already_completed():
    """Test cancelling a job that's already completed."""
    print("\n=== Test 3: Cancelling already completed job ===")
    
    async with AsyncSessionLocal() as session:
        job_id = await create_test_job(session, status="completed")
        job = await session.get(TrainingJob, job_id)
        job.finished_at = datetime.utcnow()
        await session.commit()
    
    # Try to cancel - should fail
    result = await cancel_training_job(job_id)
    print(f"cancel_training_job returned: {result}")
    
    # Check job status (should still be completed)
    async with AsyncSessionLocal() as session:
        job = await session.get(TrainingJob, job_id)
        print(f"Job status remains: {job.status}")
    
    assert result == False, "Cancellation should fail for completed job"
    assert job.status == "completed", "Job should remain completed"
    print("✓ Test 3 passed: Completed job cannot be cancelled")


async def test_cancellation_already_cancelled():
    """Test cancelling a job that's already cancelled."""
    print("\n=== Test 4: Cancelling already cancelled job ===")
    
    async with AsyncSessionLocal() as session:
        job_id = await create_test_job(session, status="cancelled")
    
    # Try to cancel - should fail
    result = await cancel_training_job(job_id)
    print(f"cancel_training_job returned: {result}")
    
    # Check job status
    async with AsyncSessionLocal() as session:
        job = await session.get(TrainingJob, job_id)
        print(f"Job status remains: {job.status}")
    
    assert result == False, "Cancellation should fail for already cancelled job"
    assert job.status == "cancelled", "Job should remain cancelled"
    print("✓ Test 4 passed: Already cancelled job cannot be cancelled again")


async def test_job_start_after_cancellation():
    """Test that a job won't start if already cancelled."""
    print("\n=== Test 5: Job start after cancellation ===")
    
    async with AsyncSessionLocal() as session:
        job_id = await create_test_job(session, status="pending")
    
    # Cancel the job first
    await cancel_training_job(job_id)
    
    # Clear _running_jobs to simulate fresh start
    _running_jobs.clear()
    
    # Try to run the job - should exit early due to cancelled status
    print(f"Attempting to run cancelled job #{job_id}...")
    await run_training_job(job_id)
    
    # Check that job wasn't added to _running_jobs
    print(f"_running_jobs after run attempt: {list(_running_jobs.keys())}")
    
    # Check job status
    async with AsyncSessionLocal() as session:
        job = await session.get(TrainingJob, job_id)
        print(f"Job status remains: {job.status}")
    
    assert job_id not in _running_jobs, "Cancelled job should not be added to _running_jobs"
    assert job.status == "cancelled", "Job should remain cancelled"
    print("✓ Test 5 passed: Cancelled job won't start")


async def main():
    """Run all tests."""
    print("Testing training job cancellation fix...")
    print("=" * 60)
    
    # Setup database
    engine = await setup_test_database()
    
    try:
        await test_cancellation_without_event()
        await test_cancellation_with_event()
        await test_cancellation_already_completed()
        await test_cancellation_already_cancelled()
        await test_job_start_after_cancellation()
        
        print("\n" + "=" * 60)
        print("All tests passed! ✓")
        print("The fix successfully handles:")
        print("1. Jobs without cancellation events (pending jobs)")
        print("2. Jobs with cancellation events (running jobs)")
        print("3. Already completed/failed jobs")
        print("4. Already cancelled jobs")
        print("5. Prevents cancelled jobs from starting")
        
    finally:
        # Cleanup
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())