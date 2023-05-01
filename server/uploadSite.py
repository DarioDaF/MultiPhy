
import os, sys
import paramiko

from df_basepath import OSPath
from df_sftp import SFTPPathFactory, sftp_makedirs
from conninfo import myServer

cdir = os.path.dirname(os.path.realpath(__file__))

def cpDirToSFTP(sftp: paramiko.SFTPClient, source, dest):
  RemotePath = SFTPPathFactory(sftp)

  blp = OSPath(source)
  brp = RemotePath(dest)

  sftp_makedirs(sftp, brp)

  for root, ds, fs in os.walk(str(blp), topdown=True):
    lp_root = OSPath(root)
    for d in ds:
      lp_d = lp_root.join(d)
      rp_d = lp_d.convert(blp, brp)
      print(f'... DIR {rp_d}')
      sftp_makedirs(sftp, rp_d)
    for f in fs:
      lp_f = lp_root.join(f)
      rp_f = lp_f.convert(blp, brp)
      print(f'...  FILE {lp_f} -> {rp_f}')
      sftp.put(str(lp_f), str(rp_f))

with paramiko.SSHClient() as cl:
  cl.set_missing_host_key_policy(paramiko.MissingHostKeyPolicy)
  cl.connect(myServer.host, myServer.port, myServer.user, pkey=myServer.pkey())
  print('Sending site...')
  with cl.open_sftp() as sftp:
    sftp.put(os.path.join(cdir, '..', 'index.html'), '/var/www/html/index.html')
    cpDirToSFTP(sftp, os.path.join(cdir, '..', 'assets'), '/var/www/html/assets')
    cpDirToSFTP(sftp, os.path.join(cdir, '..', 'dist'), '/var/www/html/dist')
