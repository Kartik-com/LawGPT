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
import { useFormatting } from '@/contexts/FormattingContext';

const Clients = () => {
  const { clients, cases, addClient, updateClient, deleteClient } = useLegalData();
  const { formatDateShort } = useFormatting();
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
    <div className="space-y-2 md:space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Client Management</h1>
          <p className="text-xs text-muted-foreground">Manage your client information and relationships</p>
        </div>

        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenDialog} size="sm" className="h-8 text-xs border border-transparent hover:border-accent hover:border-2 hover:bg-transparent hover:text-foreground transition-all">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
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

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Full Name*</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Client's full name"
                    required
                    className="border-transparent hover:border-accent hover:border-2 transition-all"
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
                    className="border-transparent hover:border-accent hover:border-2 transition-all"
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
                    className="border-transparent hover:border-accent hover:border-2 transition-all"
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
                    className="border-transparent hover:border-accent hover:border-2 transition-all"
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
                  className="border-transparent hover:border-accent hover:border-2 transition-all"
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
                  className="border-transparent hover:border-accent hover:border-2 transition-all"
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
                  className="border-transparent hover:border-accent hover:border-2 transition-all"
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setShowAddDialog(false); setSelectedClient(null); resetForm(); }} className="border-transparent hover:border-accent hover:border-2 hover:bg-transparent hover:text-foreground transition-all">
                  Cancel
                </Button>
                <Button type="submit" className="border border-transparent hover:border-accent hover:border-2 hover:bg-transparent hover:text-foreground transition-all">
                  {selectedClient ? 'Update Client' : 'Add Client'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm">Search Clients</CardTitle>
        </CardHeader>
        <CardContent className="pt-1">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or phone number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-xs border-transparent hover:border-accent hover:border-2 transition-all"
            />
          </div>
        </CardContent>
      </Card>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 md:gap-3">
        {filteredClients.map((client) => {
          const clientCases = getClientCases(client.id);
          const activeCases = clientCases.filter(c => c.status === 'active');

          return (
            <Card key={client.id} className="shadow-card-custom hover:shadow-elevated transition-shadow">
              <CardHeader className="pb-1.5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <CardTitle className="text-sm">{client.name}</CardTitle>
                      <CardDescription className="flex items-center gap-1 text-[10px]">
                        <FileText className="h-2.5 w-2.5" />
                        {clientCases.length} case{clientCases.length !== 1 ? 's' : ''}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
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
                      className="h-6 w-6 p-0 border border-transparent hover:border-accent hover:border-2 transition-all"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        if (confirm('Are you sure you want to delete this client?')) {
                          try {
                            await deleteClient(client.id);
                            toast({ title: 'Client deleted successfully' });
                          } catch (error) {
                            toast({
                              title: 'Delete failed',
                              description: error instanceof Error ? error.message : 'Unable to delete client',
                              variant: 'destructive'
                            });
                          }
                        }
                      }}
                      className="h-6 w-6 p-0 border border-transparent hover:border-accent hover:border-2 transition-all"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-1.5">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    <span className="break-all">{client.email}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    <span>{client.phone}</span>
                  </div>

                  {client.address && (
                    <div className="flex items-start gap-1.5 text-xs">
                      <MapPin className="h-3 w-3 text-muted-foreground mt-0.5" />
                      <span className="text-muted-foreground line-clamp-2">{client.address}</span>
                    </div>
                  )}

                  {(client.panNumber || client.aadharNumber) && (
                    <div className="flex flex-wrap gap-1.5 pt-1.5">
                      {client.panNumber && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1">
                          <CreditCard className="h-2.5 w-2.5 mr-0.5" />
                          PAN: {client.panNumber}
                        </Badge>
                      )}
                      {client.aadharNumber && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1">
                          <CreditCard className="h-2.5 w-2.5 mr-0.5" />
                          Aadhar: ****{client.aadharNumber.slice(-4)}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Case Status */}
                  <div className="pt-1.5 border-t">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Active Cases</span>
                      <Badge variant={activeCases.length > 0 ? 'default' : 'secondary'} className="text-[9px] h-4 px-1">
                        {activeCases.length}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-0.5">
                      <span className="text-muted-foreground">Total Cases</span>
                      <span className="font-medium">{clientCases.length}</span>
                    </div>
                  </div>

                  {client.notes && (
                    <div className="pt-1.5">
                      <p className="text-[10px] text-muted-foreground line-clamp-2">
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
                        <div className="pt-1.5 border-t">
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <Calendar className="h-2.5 w-2.5" />
                            <span>Next hearing: {formatDateShort(nextHearing.nextHearing!)}</span>
                          </div>
                          <p className="text-[10px] text-primary ml-4">{nextHearing.caseNumber}</p>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                <div className="flex gap-1.5 mt-2 pt-1.5 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-6 text-[10px] border-transparent hover:border-accent hover:border-2 hover:bg-transparent hover:text-foreground transition-all"
                    onClick={() => window.open(`tel:${client.phone}`, '_self')}
                  >
                    <Phone className="mr-1 h-2.5 w-2.5" />
                    Call
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-6 text-[10px] border-transparent hover:border-accent hover:border-2 hover:bg-transparent hover:text-foreground transition-all"
                    onClick={() => window.open(`mailto:${client.email}`, '_self')}
                  >
                    <Mail className="mr-1 h-2.5 w-2.5" />
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
          <CardContent className="text-center py-8">
            <User className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <h3 className="text-sm font-semibold mb-1">No clients found</h3>
            <p className="text-xs text-muted-foreground mb-3">
              {searchTerm
                ? 'No clients match your search criteria.'
                : 'Start by adding your first client.'
              }
            </p>
            <Button onClick={() => setShowAddDialog(true)} size="sm" className="h-8 text-xs border border-transparent hover:border-accent hover:border-2 hover:bg-transparent hover:text-foreground transition-all">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add First Client
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Clients;