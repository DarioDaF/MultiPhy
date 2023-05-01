import stat, io

import paramiko

from df_basepath import _BasePath

def SFTPPathFactory(sftp: paramiko.SFTPClient):
    cwd = sftp.getcwd()
    cwdparts = cwd.split('/') if cwd is not None else []
    class _RemotePath(_BasePath):
        MODE_NOTFETCHED = -1
        def __init__(self, path):
            super().__init__(path)
            self.__mode = _RemotePath.MODE_NOTFETCHED
        @staticmethod
        #@override
        def _toparts(path: str):
            nonlocal cwdparts
            # @WARNING: DOES NOT RESOLVE SYMLINKS
            parts = []
            if not path.startswith('/'):
                parts += cwdparts # Relative path
            for piece in path.split('/'):
                if piece == '..':
                    parts.pop()
                else:
                    parts.append(piece)
            return tuple(parts)
        def getmode(self):
            nonlocal sftp
            if self.__mode == _RemotePath.MODE_NOTFETCHED:
                try:
                    self.__mode = sftp.stat(str(self)).st_mode
                except FileNotFoundError:
                    self.__mode = None
            return self.__mode
        #@override
        def isfile(self):
            mode = self.getmode()
            return mode is not None and not stat.S_ISDIR(mode)
        #@override
        def isdir(self):
            mode = self.getmode()
            return mode is not None and stat.S_ISDIR(mode)
        #@override
        def readlines(self):
            nonlocal sftp
            print(f'READING {self}')
            buff = io.BytesIO()
            sftp.getfo(str(self), buff)
            yield from buff.getvalue().decode('utf-8').split('\n')
    return _RemotePath

def sftp_makedirs(sftp: paramiko.SFTPClient, path: _BasePath):
    toCreate = []
    for parent in path, *path.parents():
        try:
            sftp.stat(str(parent))
            break
        except FileNotFoundError:
            toCreate.append(parent)
    for parent in reversed(toCreate):
        sftp.mkdir(str(parent))

def sftp_walk(sftp: paramiko.SFTPClient, root: str, top_down: bool = False):
    if not top_down:
        raise NotImplementedError("SFTP Walk bottom up not implemented")
    # sftp.listdir_iter?
    to_pass = [ root ]

    while len(to_pass) > 0:
        curr_root = to_pass.pop()
        elements = sftp.listdir_attr(curr_root)
        ds = []
        fs = []
        for element in elements:
            isdir = stat.S_ISDIR(element.st_mode)
            if isdir:
                ds.append(element.filename)
            else:
                fs.append(element.filename)
        yield curr_root, ds, fs
        to_pass.extend(curr_root + '/' + d for d in ds)
