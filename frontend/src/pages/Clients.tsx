import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Search,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  Calendar,
  CreditCard,
  Edit,
  Trash2
} from 'lucide-react';
import { useLegalData, Client } from '@/contexts/LegalDataContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useFormAutoSave } from '@/hooks/useFormAutoSave';

const Clients = () => {
  const { clients, cases, addClient, updateClient, deleteClient } = useLegalData();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const { toast } = useToast();

  // Form state for adding/editing clients
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    panNumber: '',
    aadharNumber: '',
    notes: ''
  });

  // Auto-save form data (only when adding new client, not editing)
  const { clearSavedData, getSavedData } = useFormAutoSave('client-form', formData, {
    enabled: !selectedClient // Only auto-save for new clients, not edits
  });

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      panNumber: '',
      aadharNumber: '',
      notes: ''
    });
  };

  // Restore saved data when opening dialog for new client
  const handleOpenDialog = () => {
    setSelectedClient(null);
    const savedData = getSavedData();
    if (savedData) {
      setFormData(savedData);
      toast({
        title: 'Draft Restored',
        description: 'Your previously entered client data has been restored.',
        duration: 3000
      });
    } else {
      resetForm();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(phoneDigits)) {
      toast({
        title: 'Invalid phone number',
        description: 'Phone number must be 10 digits and start with 6-9.',
        variant: 'destructive'
      });
      return;
    }

    if (formData.panNumber) {
      const panPattern = /^[A-Z]{5}\d{4}[A-Z]$/;
      if (!panPattern.test(formData.panNumber)) {
        toast({
          title: 'Invalid PAN',
          description: 'PAN must follow the format AAAAA9999A.',
          variant: 'destructive'
        });
        return;
      }
    }

    try {
      if (selectedClient) {
        await updateClient(selectedClient.id, {
          ...formData,
          cases: selectedClient.cases,
          documents: selectedClient.documents
        });
        toast({ title: 'Client updated successfully' });
      } else {
        await addClient({
          ...formData,
          cases: [],
          documents: []
        });
        toast({ title: 'Client added successfully' });
      }

      // Clear saved draft data after successful submission
      clearSavedData();

      setShowAddDialog(false);
      setSelectedClient(null);
      resetForm();
    } catch (error) {
      toast({
        title: 'Failed to save client',
        description: error instanceof Error ? error.message : 'Unable to save client details. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Filter clients based on search
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.phone.includes(searchTerm)
  );

  // Get cases for a client
  const getClientCases = (clientId: string) => {
    return cases.filter(case_ => case_.clientName === clients.find(c => c.id === clientId)?.name);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Client Management</h1>
          <p className="text-muted-foreground">Manage your client information and relationships</p>
        </div>

        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add New Client
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedClient ? 'Edit Client' : 'Add New Client'}</DialogTitle>
              <DialogDescription>
                {selectedClient ? 'Update client information' : 'Enter the details for the new client'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Full Name*</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Client's full name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email Address*</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="client@email.com"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone Number*</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setFormData(prev => ({ ...prev, phone: digits }));
                    }}
                    placeholder="9876543210"
                    inputMode="numeric"
                    maxLength={10}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="panNumber">PAN Number</Label>
                  <Input
                    id="panNumber"
                    value={formData.panNumber}
                    onChange={(e) => {
                      const pan = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
                      setFormData(prev => ({ ...prev, panNumber: pan }));
                    }}
                    placeholder="ABCDE1234F"
                    maxLength={10}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="aadharNumber">Aadhar Number</Label>
                <Input
                  id="aadharNumber"
                  value={formData.aadharNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, aadharNumber: e.target.value.replace(/\D/g, '').slice(0, 12) }))}
                  placeholder="1234 5678 9012"
                  maxLength={12}
                  inputMode="numeric"
                />
              </div>

              <div>
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Complete address..."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes about the client..."
                  rows={2}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setShowAddDialog(false); setSelectedClient(null); resetForm(); }}>
                  Cancel
                </Button>
                <Button type="submit">
                  {selectedClient ? 'Update Client' : 'Add Client'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search Clients</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or phone number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredClients.map((client) => {
          const clientCases = getClientCases(client.id);
          const activeCases = clientCases.filter(c => c.status === 'active');

          return (
            <Card key={client.id} className="shadow-card-custom hover:shadow-elevated transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-lg">
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{client.name}</CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {clientCases.length} case{clientCases.length !== 1 ? 's' : ''}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedClient(client);
                        setFormData({
                          name: client.name,
                          email: client.email,
                          phone: client.phone,
                          address: client.address,
                          panNumber: client.panNumber || '',
                          aadharNumber: client.aadharNumber || '',
                          notes: client.notes
                        });
                        setShowAddDialog(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this client?')) {
                          deleteClient(client.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="break-all">{client.email}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{client.phone}</span>
                  </div>

                  {client.address && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span className="text-muted-foreground line-clamp-2">{client.address}</span>
                    </div>
                  )}

                  {(client.panNumber || client.aadharNumber) && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {client.panNumber && (
                        <Badge variant="outline" className="text-xs">
                          <CreditCard className="h-3 w-3 mr-1" />
                          PAN: {client.panNumber}
                        </Badge>
                      )}
                      {client.aadharNumber && (
                        <Badge variant="outline" className="text-xs">
                          <CreditCard className="h-3 w-3 mr-1" />
                          Aadhar: ****{client.aadharNumber.slice(-4)}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Case Status */}
                  <div className="pt-3 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Active Cases</span>
                      <Badge variant={activeCases.length > 0 ? 'default' : 'secondary'}>
                        {activeCases.length}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-muted-foreground">Total Cases</span>
                      <span className="font-medium">{clientCases.length}</span>
                    </div>
                  </div>

                  {client.notes && (
                    <div className="pt-2">
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        <strong>Notes:</strong> {client.notes}
                      </p>
                    </div>
                  )}

                  {/* Next Hearing */}
                  {(() => {
                    const nextHearing = clientCases
                      .filter(c => c.nextHearing && new Date(c.nextHearing) > new Date())
                      .sort((a, b) => new Date(a.nextHearing!).getTime() - new Date(b.nextHearing!).getTime())[0];

                    if (nextHearing) {
                      return (
                        <div className="pt-2 border-t">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>Next hearing: {new Date(nextHearing.nextHearing!).toLocaleDateString('en-IN')}</span>
                          </div>
                          <p className="text-xs text-primary ml-5">{nextHearing.caseNumber}</p>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                <div className="flex gap-2 mt-4 pt-3 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.open(`tel:${client.phone}`, '_self')}
                  >
                    <Phone className="mr-2 h-3 w-3" />
                    Call
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.open(`mailto:${client.email}`, '_self')}
                  >
                    <Mail className="mr-2 h-3 w-3" />
                    Email
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredClients.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <User className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No clients found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm
                ? 'No clients match your search criteria.'
                : 'Start by adding your first client.'
              }
            </p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add First Client
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Clients;