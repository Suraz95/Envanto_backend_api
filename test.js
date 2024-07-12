// Update User
router.put('/user/:id', verifyToken, async (req, res) => {
    const { id } = req.params;  // This id refers to the _id of the User document
    const { name, username, phone, email} = req.body;

    try {
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (name) user.name = name;
        if (username) user.username = username;
        if (phone) user.phone = phone;
        if (email) user.email = email;
        await user.save();
        res.status(200).json({ message: 'User updated successfully', user });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete User
router.delete('/user/:id', verifyToken, async (req, res) => {
    const { id } = req.params;  // This id refers to the _id of the User document

    try {
        const user = await User.findByIdAndDelete(id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Add Address
router.post('/user/:id/address', verifyToken, async (req, res) => {
    const { id } = req.params;  // This id refers to the _id of the User document
    const { name, phone, pincode, state, city, locality, landmark } = req.body;

    try {
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.addresses.push({ name, phone, pincode, state, city, locality, landmark });
        await user.save();

        res.status(200).json({ message: 'Address added successfully', addresses: user.addresses });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete Address
router.delete('/user/:id/address/:addressId',verifyToken, async (req, res) => {
    const { id, addressId } = req.params;  // id refers to the id of the User document, addressId refers to the id of the Address sub-document

    try {
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const addressIndex = user.addresses.findIndex(address => address._id.toString() === addressId);
        if (addressIndex === -1) return res.status(404).json({ message: 'Address not found' });

        user.addresses.splice(addressIndex, 1);
        await user.save();

        res.status(200).json({ message: 'Address deleted successfully', addresses: user.addresses });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});