
from abc import ABC, abstractmethod
from typing import Iterator
import os
from functools import cache

class _BasePath(ABC):
    def __init__(self, path):
        if path is None:
            path = tuple()
        if isinstance(path, str):
            # Suppose path alwats "absolute"-like
            self.__parts = type(self)._toparts(path)
        elif isinstance(path, _BasePath):
            self.__parts = path.__parts
        else:
            self.__parts = path

    @staticmethod
    @abstractmethod # Must be innermost decorator!
    def _toparts(path: str) -> tuple[str]:
        pass
    @abstractmethod
    def isfile(self) -> bool:
        pass
    @abstractmethod
    def isdir(self) -> bool:
        pass
    @abstractmethod
    def readlines(self) -> Iterator[str]:
        pass

    @property
    def parts(self):
        return self.__parts

    def join(self, name):
        return type(self)(self.__parts + (name,))

    def relpath(self, base_path):
        if self.__parts[:len(base_path.__parts)] == base_path.__parts:
            return '/'.join(self.__parts[len(base_path.__parts):])
        else:
            return None

    def convert(self, base_from, base_to):
        if self.__parts[:len(base_from.__parts)] == base_from.__parts:
            return type(base_to)(base_to.__parts + self.__parts[len(base_from.__parts):])
        return None

    def parent(self):
        return type(self)(self.__parts[:-1])

    def parents(self, root=None):
        for i in range(len(self.__parts) - 1, 0, -1):
            parent = type(self)(self.__parts[:i])
            if (root is not None) and (parent.__parts[:len(root.__parts)] != root.__parts):
                break
            yield parent

    def __str__(self):
        if self.__parts == ('', ):
            return '/'
        return '/'.join(self.__parts)

class OSPath(_BasePath):
    @staticmethod
    #@override
    def _toparts(path: str):
        return tuple(os.path.abspath(path).split(os.sep))
    @cache
    #@override
    def isfile(self):
        return os.path.isfile(str(self))
    @cache
    #@override
    def isdir(self):
        return os.path.isdir(str(self))
    #@override
    def readlines(self):
        with open(str(self), 'rt', encoding='utf-8') as fp:
            yield from fp
