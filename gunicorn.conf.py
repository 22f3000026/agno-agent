import multiprocessing

# Server socket
bind = "0.0.0.0:8000"
backlog = 2048

# Worker processes
workers = 2
worker_class = "gthread"
worker_connections = 1000
threads = 4
max_requests = 1000
max_requests_jitter = 50

# Timeout settings
timeout = 120
keepalive = 2
graceful_timeout = 30

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = "agno-agent"

# Preload app
preload_app = True

# Restart workers after this many requests
max_requests = 1000
max_requests_jitter = 50

# Restart workers after this many seconds
worker_tmp_dir = "/dev/shm"

# Enable auto restart
reload = False 