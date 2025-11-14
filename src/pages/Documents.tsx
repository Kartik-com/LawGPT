import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  File,
  FileText,
  Image,
  Video,
  Music,
  Download,
  Search,
  Eye,
  Trash2,
  FolderOpen,
  Plus,
  Calendar,
  HardDrive,
  Edit,
  Share,
  MoreVertical,
} from 'lucide-react';
import { useLegalData } from '@/contexts/LegalDataContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ApiFile { 
  _id: string; 
  name: string; 
  mimetype: string; 
  size: number; 
  url: string; 
  createdAt: string; 
  folderId?: string; 
  tags?: string[];
  ownerId: string;
}

interface ApiFolder { 
  _id: string; 
  name: string; 
  parentId?: string;
  ownerId: string;
  createdAt: string;
}

type DocType = 'pdf' | 'doc' | 'docx' | 'image' | 'video' | 'audio' | 'other';

const Documents = () => {
  const { cases } = useLegalData();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [caseFilter, setCaseFilter] = useState('all');
  const { toast } = useToast();

  const [folders, setFolders] = useState<ApiFolder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const [files, setFiles] = useState<ApiFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFile, setSelectedFile] = useState<ApiFile | null>(null);
  const [showFileDetailsDialog, setShowFileDetailsDialog] = useState(false);
  
  // Import API utility
  const getApiUrl = (path: string) => {
    const apiUrl = (import.meta as any).env?.VITE_API_URL;
    if (apiUrl) {
      return `${apiUrl}${path.startsWith('/') ? path : `/${path}`}`;
    }
    return path.startsWith('/') ? path : `/${path}`;
  };

  const detectType = (mimetype: string): DocType => {
    if (mimetype.includes('pdf')) return 'pdf';
    if (mimetype.includes('image')) return 'image';
    if (mimetype.includes('video')) return 'video';
    if (mimetype.includes('audio')) return 'audio';
    if (mimetype.includes('msword')) return 'doc';
    if (mimetype.includes('officedocument.wordprocessingml')) return 'docx';
    return 'other';
  };

  const getFileIcon = (type: DocType) => {
    switch (type) {
      case 'pdf':
        return <FileText className="h-8 w-8 text-red-500" />;
      case 'doc':
      case 'docx':
        return <FileText className="h-8 w-8 text-blue-500" />;
      case 'image':
        return <Image className="h-8 w-8 text-green-500" />;
      case 'video':
        return <Video className="h-8 w-8 text-purple-500" />;
      case 'audio':
        return <Music className="h-8 w-8 text-orange-500" />;
      default:
        return <File className="h-8 w-8 text-gray-500" />;
    }
  };

  const getTypeColor = (type: DocType) => {
    switch (type) {
      case 'pdf': return 'bg-red-100 text-red-800 border-red-200';
      case 'doc':
      case 'docx': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'image': return 'bg-green-100 text-green-800 border-green-200';
      case 'video': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'audio': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredFiles = useMemo(() => {
    return files.filter(f => {
      const matchesSearch = f.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'all' || detectType(f.mimetype) === typeFilter;
      const matchesCase = caseFilter === 'all';
      return matchesSearch && matchesType && matchesCase;
    });
  }, [files, searchTerm, typeFilter, caseFilter]);

  const handleFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.mp4,.mp3,.txt,.xlsx,.pptx';

    input.onchange = async (event) => {
      const f = (event.target as HTMLInputElement).files;
      if (!f || f.length === 0) return;
      
      const form = new FormData();
      Array.from(f).forEach(file => form.append('files', file));
      if (currentFolderId) form.append('folderId', currentFolderId);
      
      try {
        setIsLoading(true);
        const res = await fetch(getApiUrl('/api/documents/upload'), { 
          method: 'POST', 
          credentials: 'include', 
          body: form 
        });
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          const errorMessage = errorData.error || 'Upload failed';
          const helpMessage = errorData.help;
          
          // Show detailed error with help if available
          toast({ 
            title: 'Upload Failed', 
            description: helpMessage 
              ? `${errorMessage}\n\n${helpMessage}`
              : errorMessage,
            variant: 'destructive',
            duration: 10000 // Show for 10 seconds for configuration errors
          });
          throw new Error(errorMessage);
        }
        
        await loadFiles();
        toast({ 
          title: 'Upload Successful', 
          description: `${f.length} file(s) uploaded successfully` 
        });
      } catch (error) {
        console.error('Upload error:', error);
        // Don't show duplicate toast if we already showed one above
        if (!error.message || !error.message.includes('Upload failed')) {
          toast({ 
            title: 'Upload Failed', 
            description: error instanceof Error ? error.message : 'Failed to upload files',
            variant: 'destructive' 
          });
        }
      } finally {
        setIsLoading(false);
      }
    };

    input.click();
  };

  const fileUrl = (doc: ApiFile) => {
    // If URL is already a full URL (Cloudinary or external), use it directly
    if (doc.url && (doc.url.startsWith('http://') || doc.url.startsWith('https://'))) {
      return doc.url;
    }
    // Otherwise, prepend backend URL for local file paths
    const apiUrl = (import.meta as any).env?.VITE_API_URL;
    if (apiUrl) {
      return `${apiUrl}${doc.url}`;
    }
    return doc.url;
  };

  const handleDownload = async (doc: ApiFile) => {
    try {
      const url = fileUrl(doc);
      
      // For Cloudinary URLs, fetch the file and create a blob for download
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch file');
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = doc.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Clean up the blob URL
        URL.revokeObjectURL(blobUrl);
      } else {
        // For local files, use direct download
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Download Failed',
        description: error instanceof Error ? error.message : 'Failed to download file',
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (doc: ApiFile) => {
    if (!confirm(`Are you sure you want to delete "${doc.name}"?`)) return;
    
    try {
      setIsLoading(true);
      const res = await fetch(getApiUrl(`/api/documents/files/${doc._id}`), { 
        method: 'DELETE', 
        credentials: 'include' 
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Delete failed');
      }
      
      await loadFiles();
      toast({ title: 'Document Deleted', description: `${doc.name} has been deleted` });
    } catch (error) {
      console.error('Delete error:', error);
      toast({ 
        title: 'Delete Failed', 
        description: error instanceof Error ? error.message : 'Failed to delete document',
        variant: 'destructive' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadFolders = async () => {
    try {
      const res = await fetch(getApiUrl('/api/documents/folders'), { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
      } else {
        console.error('Failed to load folders');
        setFolders([]);
      }
    } catch (error) {
      console.error('Load folders error:', error);
      setFolders([]);
    }
  };

  const loadFiles = async () => {
    try {
      // Load files for current folder (or root if no folder selected)
      const q = currentFolderId ? `?folderId=${currentFolderId}` : '?folderId=null';
      const res = await fetch(getApiUrl(`/api/documents/files${q}`), { credentials: 'include' });
      
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      } else {
        console.error('Failed to load files');
        setFiles([]);
      }
    } catch (error) {
      console.error('Load files error:', error);
      setFiles([]);
    }
  };

  const createFoldersForExistingCases = async () => {
    try {
      // Get all existing folders
      const foldersRes = await fetch('/api/documents/folders', { credentials: 'include' });
      if (!foldersRes.ok) return;
      
      const foldersData = await foldersRes.json();
      const existingFolders = foldersData.folders || [];
      
      // Check each case to see if it has a corresponding folder
      for (const case_ of cases) {
        const expectedFolderName = `${case_.caseNumber} - ${case_.clientName}`;
        const folderExists = existingFolders.some((folder: any) => folder.name === expectedFolderName);
        
        if (!folderExists) {
          try {
            const folderRes = await fetch(getApiUrl('/api/documents/folders'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ name: expectedFolderName })
            });
            
            if (folderRes.ok) {
              console.log(`Created folder for existing case: ${expectedFolderName}`);
            }
          } catch (error) {
            console.warn(`Failed to create folder for case ${case_.caseNumber}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn('Error creating folders for existing cases:', error);
    }
  };

  useEffect(() => { 
    loadFolders(); 
    createFoldersForExistingCases();
  }, []);
  useEffect(() => { loadFiles(); }, [currentFolderId]);

  const createFolder = async () => {
    if (!newFolderName.trim()) {
      toast({ title: 'Error', description: 'Folder name is required', variant: 'destructive' });
      return;
    }
    
    try {
      const res = await fetch(getApiUrl('/api/documents/folders'), {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        credentials: 'include',
        body: JSON.stringify({ name: newFolderName.trim(), parentId: currentFolderId })
      });
      
      if (res.ok) { 
        await loadFolders(); 
        setNewFolderName('');
        setShowCreateFolderDialog(false);
        toast({ title: 'Folder Created', description: `Folder "${newFolderName}" created successfully` }); 
      } else {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create folder');
      }
    } catch (error) {
      console.error('Create folder error:', error);
      toast({ 
        title: 'Create Failed', 
        description: error instanceof Error ? error.message : 'Failed to create folder',
        variant: 'destructive' 
      });
    }
  };

  const deleteFolder = async (folder: ApiFolder) => {
    if (!confirm(`Delete folder "${folder.name}" and all its contents?`)) return;
    
    try {
      const res = await fetch(getApiUrl(`/api/documents/folders/${folder._id}`), { 
        method: 'DELETE', 
        credentials: 'include' 
      });
      
      if (res.ok) { 
        if (currentFolderId === folder._id) setCurrentFolderId(undefined); 
        await loadFolders(); 
        await loadFiles(); 
        toast({ title: 'Folder Deleted', description: `Folder "${folder.name}" deleted successfully` }); 
      } else {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete folder');
      }
    } catch (error) {
      console.error('Delete folder error:', error);
      toast({ 
        title: 'Delete Failed', 
        description: error instanceof Error ? error.message : 'Failed to delete folder',
        variant: 'destructive' 
      });
    }
  };

  // Calculate statistics
  const totalFiles = files.length;
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const imageFiles = files.filter(f => detectType(f.mimetype) === 'image').length;
  const documentFiles = files.filter(f => ['pdf', 'doc', 'docx'].includes(detectType(f.mimetype))).length;
  const videoFiles = files.filter(f => detectType(f.mimetype) === 'video').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Document Management</h1>
          <p className="text-muted-foreground">
            Secure storage and organization for all your legal documents
          </p>
        </div>
        
        <div className="flex gap-2">
          <Dialog open={showCreateFolderDialog} onOpenChange={setShowCreateFolderDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={isLoading}>
                <FolderOpen className="mr-2 h-4 w-4" />
                New Folder
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Folder</DialogTitle>
                <DialogDescription>
                  Enter a name for your new document folder
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="folderName">Folder Name</Label>
                  <Input
                    id="folderName"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Enter folder name..."
                    onKeyDown={(e) => e.key === 'Enter' && createFolder()}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateFolderDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={createFolder} disabled={!newFolderName.trim()}>
                  Create Folder
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          <Button onClick={handleFileUpload} disabled={isLoading}>
            <Upload className="mr-2 h-4 w-4" />
            Upload Documents
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="shadow-card-custom">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            <File className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalFiles}</div>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(totalSize)} total size
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card-custom">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Images</CardTitle>
            <Image className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{imageFiles}</div>
            <p className="text-xs text-muted-foreground">Image files</p>
          </CardContent>
        </Card>

        <Card className="shadow-card-custom">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
            <FileText className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{documentFiles}</div>
            <p className="text-xs text-muted-foreground">PDF/DOC files</p>
          </CardContent>
        </Card>

        <Card className="shadow-card-custom">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Videos</CardTitle>
            <Video className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{videoFiles}</div>
            <p className="text-xs text-muted-foreground">Video files</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="shadow-card-custom">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Search & Filter Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="File Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="doc">DOC</SelectItem>
                <SelectItem value="docx">DOCX</SelectItem>
                <SelectItem value="image">Images</SelectItem>
                <SelectItem value="video">Videos</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
              </SelectContent>
            </Select>

            <Select value={caseFilter} onValueChange={setCaseFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Case" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cases</SelectItem>
                {cases.map(case_ => (
                  <SelectItem key={case_.id} value={case_.id}>
                    {case_.caseNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Folders Section */}
      {folders.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Folders</h2>
            <Badge variant="outline">{folders.length} folders</Badge>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {folders.map((folder) => (
              <Card 
                key={folder._id} 
                className={`shadow-card-custom hover:shadow-elevated transition-all cursor-pointer ${
                  currentFolderId === folder._id ? 'ring-2 ring-primary bg-primary/5' : ''
                }`}
                onClick={() => setCurrentFolderId(folder._id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                        <FolderOpen className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-sm line-clamp-1">{folder.name}</CardTitle>
                        <CardDescription className="text-xs">
                          Created {formatDate(folder.createdAt)}
                        </CardDescription>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setCurrentFolderId(folder._id); }}>
                          <Eye className="mr-2 h-4 w-4" />
                          Open Folder
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={(e) => { e.stopPropagation(); deleteFolder(folder); }}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Folder
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Current Folder Info */}
      {currentFolderId && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FolderOpen className="h-4 w-4" />
          <span>Viewing folder: {folders.find(f => f._id === currentFolderId)?.name}</span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setCurrentFolderId(undefined)}
            className="text-primary hover:text-primary/80"
          >
            View All Folders
          </Button>
        </div>
      )}

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredFiles.map((doc) => {
          const type = detectType(doc.mimetype);
          return (
            <Card key={doc._id} className="shadow-card-custom hover:shadow-elevated transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-12 h-12 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                      {getFileIcon(type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <CardTitle className="text-sm filename-truncate cursor-help">
                              {doc.name}
                            </CardTitle>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs break-words">{doc.name}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <HardDrive className="h-3 w-3" />
                        {formatFileSize(doc.size)}
                      </CardDescription>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => window.open(fileUrl(doc), '_blank')}>
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownload(doc)}>
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setSelectedFile(doc); setShowFileDetailsDialog(true); }}>
                        <Edit className="mr-2 h-4 w-4" />
                        Details
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleDelete(doc)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={`text-xs ${getTypeColor(type)}`}>
                      {type.toUpperCase()}
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatDate(doc.createdAt)}
                    </div>
                  </div>

                  {doc.tags && doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {doc.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-4 pt-3 border-t">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => window.open(fileUrl(doc), '_blank')}
                  >
                    <Eye className="mr-2 h-3 w-3" />
                    View
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => handleDownload(doc)}
                  >
                    <Download className="mr-2 h-3 w-3" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredFiles.length === 0 && (
        <Card className="shadow-card-custom">
          <CardContent className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <File className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No documents found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || typeFilter !== 'all' 
                ? 'No documents match your current filters.' 
                : currentFolderId 
                  ? 'This folder is empty. Upload your first document.'
                  : 'Select a folder to view documents or create a new folder.'
              }
            </p>
            {currentFolderId && (
              <Button onClick={handleFileUpload}>
                <Upload className="mr-2 h-4 w-4" />
                Upload Documents
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upload Drop Zone */}
      <Card className="shadow-card-custom border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors">
        <CardContent className="text-center py-8">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Drop files here to upload</h3>
          <p className="text-muted-foreground mb-4">
            Supports PDF, DOC, DOCX, images, videos, and audio files
          </p>
          <Button onClick={handleFileUpload} disabled={isLoading}>
            {isLoading ? 'Uploading...' : 'Choose Files to Upload'}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">Maximum file size: 50MB per file</p>
        </CardContent>
      </Card>

      {/* File Details Dialog */}
      <Dialog open={showFileDetailsDialog} onOpenChange={setShowFileDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Document Details</DialogTitle>
            <DialogDescription>
              View and manage document information
            </DialogDescription>
          </DialogHeader>
          
          {selectedFile && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg bg-gray-50 flex items-center justify-center">
                  {getFileIcon(detectType(selectedFile.mimetype))}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{selectedFile.name}</h3>
                  <p className="text-muted-foreground">
                    {formatFileSize(selectedFile.size)} • {detectType(selectedFile.mimetype).toUpperCase()}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Upload Date</Label>
                  <p className="font-medium">{formatDate(selectedFile.createdAt)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">File Type</Label>
                  <p className="font-medium">{selectedFile.mimetype}</p>
                </div>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => window.open(fileUrl(selectedFile), '_blank')}
                  className="flex-1"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View File
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleDownload(selectedFile)}
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Documents;