import ftplib
import os

host = "ftp.byethost7.com"
user = "b7_42110252"
pwd = "@Poteto2023"
path = "/htdocs"

def upload_dir(ftp, local_path, remote_path):
    print(f"Entering directory: {local_path} -> {remote_path}")
    
    # Try to create remote directory
    try:
        ftp.mkd(remote_path)
    except ftplib.error_perm as e:
        # Ignore "directory already exists" errors
        if not str(e).startswith('550'):
            print(f"Error creating directory {remote_path}: {e}")
            
    # Change to remote directory
    ftp.cwd(remote_path)
    
    # Iterate over items in local directory
    for item in os.listdir(local_path):
        # Skip hidden files, git files, and IDE configs
        if item.startswith('.') or item == '__pycache__' or item == 'node_modules':
            continue
            
        # Also skip python scripts and temporary files
        if item == 'upload_ftp.py' or item == 'ftp_script.txt' or item == 'reset_israx.php':
            continue
            
        local_item = os.path.join(local_path, item)
        remote_item = f"{remote_path}/{item}"
        
        if os.path.isfile(local_item):
            print(f"Uploading file: {item}")
            try:
                with open(local_item, 'rb') as f:
                    ftp.storbinary(f'STOR {item}', f)
            except Exception as e:
                print(f"Failed to upload {item}: {e}")
        elif os.path.isdir(local_item):
            upload_dir(ftp, local_item, remote_item)
            # Must return to the current remote path after returning from recursion
            ftp.cwd(remote_path)

try:
    print(f"Connecting to FTP: {host}")
    ftp = ftplib.FTP(host, user, pwd)
    print("Connected!")
    
    # Start recursive upload from current directory
    upload_dir(ftp, ".", path)
    
    ftp.quit()
    print("Upload completely successful!")
except Exception as e:
    print(f"Fatal Error: {e}")
