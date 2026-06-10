import os

# Prevent OpenMP/MKL deadlocks in multithreaded test environments on Windows
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["TESTING"] = "1"
