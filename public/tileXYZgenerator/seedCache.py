#!/usr/bin/env python
import os
import sys
#from xyz import *
from z10 import *

iterator = 0
for xyz in XYZ:
	curl = "curl --silent --request GET " + "'" + "http://localhost:9001/se/renderTile?y=" + str(xyz[1]) + '&x=' + str(xyz[0]) + '&z=' + str(xyz[2]) + "' > /dev/null"
	os.system(curl) 
	if iterator > 10:
		print 0
		sys.exit(0)